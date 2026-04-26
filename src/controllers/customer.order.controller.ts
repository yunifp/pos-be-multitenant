import { Request, Response } from 'express';
import { PrismaClient, OrderType } from '@prisma/client';
import { includes } from 'zod';
import { disconnect } from 'process';
const midtransClient = require('midtrans-client');

const prisma = new PrismaClient();

// Konfigurasi Midtrans Snap
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

export const CustomerOrderController = {
    // 1. Ambil Data Menu & Pengaturan Toko
    getInitialData: async (req: Request, res: Response) => {
        try {
            const { branchId } = req.params;
            if (!branchId) return res.status(400).json({ message: "Branch ID diperlukan." });

            const branch = await prisma.branch.findUnique({ where: { id: branchId } });
            if (!branch) return res.status(404).json({ message: "Cabang tidak ditemukan." });

            const settings = await prisma.generalSetting.findFirst({ where: { id: 1 } });
            const settingsWithBranch = settings ? { ...settings, branch: branch.name } : null;

            const categories = await prisma.category.findMany({
                where: {
                    branches: { some: { id: branchId } },
                    isActive: true
                },
                include: {
                    products: {
                        where: { branchId, deletedAt: null },
                        include: { 
                            branch: { select: { id: true, name: true } }, 
                            category: true, 
                            variants: { where: { isActive: true }, include: { stocks: true, promotionTargets: { include :{promotion : true} } } } 
                        },
                    }
                },
                orderBy: { name: 'asc' }
            });
            
            return res.json({ settings: settingsWithBranch, categories });
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    },

    // 2. Buat Pesanan Baru (Sync Logic dengan POS)
    createOrder: async (req: Request, res: Response) => {
        try {
            const { 
                branchId, 
                customerName, 
                tableNumber, 
                items, 
                notes, 
                memberId, // Diambil dari body
                pointsUsed = 0 // Default 0 jika tidak ada redeem
            } = req.body;

            // Cari Fallback Kasir (Manager/Owner)
            const fallbackCashier = await prisma.user.findFirst({
                where: { branchId, role: 'MANAGER', isActive: true }
            }) || await prisma.user.findFirst({
                where: { branchId, role: 'OWNER', isActive: true }
            });

            if (!fallbackCashier) return res.status(400).json({ message: "Sistem cabang belum siap." });

            const result = await prisma.$transaction(async (tx) => {
                let subtotal = 0;
                const invoiceNumber = `WEB-${Date.now()}-${tableNumber}`;

                // 1. Siapkan Item untuk Midtrans (Wajib Bulat)
                const midtransItems = items.map((item: any) => {
                    const price = Math.round(parseFloat(item.price));
                    const quantity = parseInt(item.quantity);
                    subtotal += price * quantity;
                    return { 
                        id: String(item.variantId), 
                        price, 
                        quantity, 
                        name: item.name.substring(0, 50) 
                    };
                });

                // 2. Simpan Order Utama
                const order = await tx.order.create({
                    data: {
                        branchId,
                        cashierId: fallbackCashier.id,
                        invoiceNumber,
                        customerName,
                        notes: `Meja: ${tableNumber}. ${notes || ""}`,
                        orderType: OrderType.DINE_IN,
                        platformName: "Web Self-Order",
                        subtotal,
                        totalAmount: subtotal - pointsUsed, 
                        paymentStatus: 'UNPAID',
                        paymentMethod: 'MIDTRANS',
                        status: 'PENDING',
                        memberId: memberId || null,
                        items: {
                            create: items.map((i: any) => ({
                                variantId: parseInt(i.variantId),
                                quantity: parseInt(i.quantity),
                                price: parseFloat(i.price),
                                hpp : parseFloat(i.hpp) || 0,
                                discount: parseFloat(i.discount) || 0,
                                notes: i.notes || "",
                                subtotal: parseFloat(i.price) * parseInt(i.quantity)
                            }))
                        }
                    }
                });

                // 3. Proses Member Redeem (Jika Ada)
                if (memberId && pointsUsed > 0) {
                    const settings = await tx.generalSetting.findFirst();
                    if (settings?.isActive) {
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
                }

                // 4. Create Midtrans Transaction
                const transaction = await snap.createTransaction({
                    transaction_details: { 
                        order_id: order.id, 
                        gross_amount: Math.round(subtotal - pointsUsed) 
                    },
                    item_details: midtransItems,
                    customer_details: { first_name: customerName }
                });

                return { orderId: order.id, snapToken: transaction.token };
            });

            return res.json(result);
        } catch (error: any) {
            console.error("Order Error:", error);
            return res.status(500).json({ message: error.message });
        }
    },

    // 3. Ambil Data Struk Digital
    getOrderPrintData: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const order = await prisma.order.findUnique({
                where: { id },
                include: {
                    branch: { include: { receiptSetting: true } },
                    items: { include: { variant: { include: { product: true } } } }
                }
            });
            if (!order) return res.status(404).json({ message: "Data tidak ditemukan" });
            return res.json({ order, receiptSetting: order.branch.receiptSetting });
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    },

    verifyMember: async (req: Request, res: Response) => {
        try {
            // Ambil dari params karena rutenya /:phone
            const { phone } = req.params; 
    
            if (!phone) {
                return res.status(400).json({ message: "Nomor HP diperlukan" });
            }
    
            const member = await prisma.member.findFirst({
                where: { 
                    phone: String(phone), // Pastikan tipe data sesuai (String)
                    isActive: true 
                }
            });
    
            if (!member) {
                return res.status(404).json({ message: "Member tidak ditemukan" });
            }
    
            res.json(member);
        } catch (error) {
            res.status(500).json({ message: "Error server saat verifikasi member" });
        }
    },

    // 4. Webhook Notifikasi (Update Stok & Cashflow)
    handleNotification: async (req: Request, res: Response) => {
        try {
            const statusResponse = await snap.transaction.notification(req.body);
            
            // Cek apakah transaksi berhasil (settlement atau capture untuk kartu kredit)
            if (statusResponse.transaction_status === 'settlement' || statusResponse.transaction_status === 'capture') {
                
                await prisma.$transaction(async (tx) => {
                    // 1. Ambil data order beserta pengaturan poin
                    const order = await tx.order.findUnique({
                        where: { id: statusResponse.order_id },
                        include: { 
                            items: { include: { variant: true } },
                            branch: true // Untuk mendapatkan relasi ke settings jika diperlukan
                        }
                    });

                    // Validasi order
                    if (!order || order.paymentStatus === 'PAID') return;


                    // 3. Update Status Order
                    await tx.order.update({
                        where: { id: order.id },
                        data: { 
                            paymentStatus: 'PAID', 
                            status: 'PENDING', // Web order langsung READY (untuk dapur) setelah bayar
                            paymentMethod: 'MIDTRANS' 
                        }
                    });

                    // 4. Update Stok Produk
                    for (const item of order.items) {
                        if (item.variant.manageStock) {
                            await tx.productStock.update({
                                where: { 
                                    branchId_variantId: { 
                                        branchId: order.branchId, 
                                        variantId: item.variantId 
                                    } 
                                },
                                data: { quantity: { decrement: item.quantity } }
                            });
                        }
                    }

                });
            }
            
            return res.status(200).send('OK');
        } catch (error: any) { 
            console.error("WEBHOOK_ERROR:", error.message);
            return res.status(500).send(error.message); 
        }
    }
};