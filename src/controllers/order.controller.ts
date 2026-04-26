import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handlePOSOrder = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const {
            id,
            items,
            customerName,
            orderType,
            platformName,
            paymentMethod,
            paymentStatus,
            status,
            totalAmount,
            subtotal,
            discount,
            tax,
            serviceCharge,
            memberId,
            promotionId, // ID Promo Billing (Transaction level)
            pointsUsed   // Jumlah poin yang digunakan dari frontend
        } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Logika Nomor Invoice
            let invoiceNumber = `INV-${Date.now()}`;
            if (id) {
                const existing = await tx.order.findUnique({ where: { id } });
                if (existing) invoiceNumber = existing.invoiceNumber;
            }

            // 2. Simpan/Update Order Utama (Upsert)
            const order = await tx.order.upsert({
                where: { id: id || 'temp-id-' + Date.now() },
                update: {
                    customerName, orderType, platformName, paymentMethod, paymentStatus, status,
                    subtotal, totalAmount, discount, tax, serviceCharge, memberId,
                    items: {
                        deleteMany: {},
                        create: items.map((i: any) => ({
                            variantId: i.variantId,
                            quantity: i.quantity,
                            price: i.price,
                            subtotal: i.subtotal,
                            discount: (Number(i.originalPrice || i.price) - Number(i.price)) * i.quantity
                        }))
                    },
                    appliedPromotions: { deleteMany: {} }
                },
                create: {
                    branchId: user.branchId,
                    cashierId: user.id,
                    invoiceNumber,
                    customerName, orderType, platformName, paymentMethod, paymentStatus, status,
                    subtotal, totalAmount, discount, tax, serviceCharge, memberId,
                    items: {
                        create: items.map((i: any) => ({
                            variantId: i.variantId,
                            quantity: i.quantity,
                            price: i.price,
                            hpp: i.hpp,
                            subtotal: i.subtotal,
                            discount: (Number(i.originalPrice || i.price) - Number(i.price)) * i.quantity
                        }))
                    }
                }
            });

            // 3. Logika Pencatatan Multi-Promo (Relasi order_promotions)
            const promoEntries: any[] = [];
            
            // A. Promo Level Item (Bundle & Product Discount)
            const itemPromos = items.filter((i: any) => i.appliedBundleId || i.appliedProductId);
            const groupedItemPromos = itemPromos.reduce((acc: any, curr: any) => {
                const pId = curr.appliedBundleId || curr.appliedProductId;
                const discAmt = (Number(curr.originalPrice || curr.price) - Number(curr.price)) * curr.quantity;
                acc[pId] = (acc[pId] || 0) + discAmt;
                return acc;
            }, {});

            for (const [pId, amt] of Object.entries(groupedItemPromos)) {
                promoEntries.push({ orderId: order.id, promotionId: pId, discountAmount: amt });
            }

            // B. Promo Level Billing (Transaction)
            if (promotionId && Number(discount) > 0) {
                promoEntries.push({ orderId: order.id, promotionId: promotionId, discountAmount: Number(discount) });
            }

            if (promoEntries.length > 0) {
                await tx.orderPromotion.createMany({ data: promoEntries });
            }

            // 4. Logika Loyalty Points (Redeem & Earn)
            if (memberId) {
                const settings = await tx.generalSetting.findFirst();

                // A. Proses Penukaran Poin (Redeem)
                if (settings?.isActive && pointsUsed > 0) {
                    await tx.member.update({
                        where: { id: memberId },
                        data: { points: { decrement: pointsUsed } }
                    });

                    await tx.memberPointHistory.create({
                        data: {
                            memberId,
                            orderId: order.id,
                            type: 'REDEEMED',
                            amount: pointsUsed,
                            description: `Tukar poin pada invoice ${invoiceNumber}`
                        }
                    });
                }

                // B. Proses Perolehan Poin Baru (Earn) - Terjadi jika status PAID/COMPLETED
                if ((status === 'COMPLETED' || paymentStatus === 'PAID') && settings?.isActive) {
                    if (totalAmount >= (settings.minOrderToEarn || 0)) {
                        const earned = Math.floor(totalAmount / (settings.pointsPerAmount || 10000)) * (settings.pointsEarned || 1);
                        
                        if (earned > 0) {
                            await tx.member.update({
                                where: { id: memberId },
                                data: { points: { increment: earned } }
                            });

                            await tx.memberPointHistory.create({
                                data: {
                                    memberId,
                                    orderId: order.id,
                                    type: 'EARNED',
                                    amount: earned,
                                    description: `Poin belanja invoice ${invoiceNumber}`
                                }
                            });
                        }
                    }
                }
            }

            // 5. Logika Pengurangan Stok (Hanya saat status COMPLETED)
            if (status === 'COMPLETED') {
                for (const item of items) {
                    const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
                    if (variant?.manageStock) {
                        await tx.productStock.update({
                            where: { branchId_variantId: { branchId: user.branchId, variantId: item.variantId } },
                            data: { quantity: { decrement: item.quantity } }
                        });
                    }
                }
            }

            return order;
        });

        res.json(result);
    } catch (error: any) {
        console.error("POS Order Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Fungsi pendukung lainnya (Open Ticket & Print Data)
export const getOpenTickets = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const tickets = await prisma.order.findMany({
            where: { branchId: user.branchId, paymentStatus: 'UNPAID' },
            include: { 
                items: { include: { variant: { include: { product: true } } } }, 
                member: true,
                appliedPromotions: { include: { promotion: true } } 
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tickets);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getOrderPrintData = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                branch: { include: { receiptSetting: true } },
                cashier: { select: { fullName: true } },
                member: { select: { name: true, points: true } },
                appliedPromotions: { include: { promotion: true } },
                items: {
                    include: {
                        variant: { include: { product: { select: { name: true } } } }
                    }
                }
            }
        });

        if (!order) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

        const receiptSetting = order.branch.receiptSetting || {
            storeName: order.branch.name,
            headerAddress: order.branch.address,
            headerPhone: order.branch.phone,
            showLogo: true,
            paperWidth: 58,
            showCashierName: true
        };

        res.json({ order, receiptSetting });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};