import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

export const orderHistoryController = {
    getHistory: async (req: Request, res: Response) => {
        try {
            const { branchId, range } = req.query;
            let whereClause: any = {};

            // 1. Filter Cabang
            if (branchId && branchId !== 'all') {
                whereClause.branchId = branchId as string;
            }

            // 2. Filter Rentang Tanggal
            const now = new Date();
            let startDate = startOfDay(now);
            let endDate = endOfDay(now);

            if (range === '7D') startDate = startOfDay(subDays(now, 7));
            else if (range === '14D') startDate = startOfDay(subDays(now, 14));
            else if (range === 'MONTH') startDate = startOfMonth(now);

            whereClause.createdAt = { gte: startDate, lte: endDate };

            // 3. Ambil Data Orders
            const orders = await prisma.order.findMany({
                where: whereClause,
                include: {
                    cashier: { select: { fullName: true } },
                    member: { select: { name: true } },
                    items: { include: { variant: { include: { product: true } } } },
                    appliedPromotions: { include: { promotion: true } },
                    refundRequest: true
                },
                orderBy: { createdAt: 'desc' }
            });

            // 4. Hitung Statistik (Agregasi)
            const stats = {
                totalCount: orders.length,
                totalOmzet: orders.filter(o => o.paymentStatus === 'PAID').reduce((acc, o) => acc + Number(o.totalAmount), 0),
                paidCount: orders.filter(o => o.paymentStatus === 'PAID').length,
                unpaidCount: orders.filter(o => o.paymentStatus === 'UNPAID').length,
                refundPendingCount: orders.filter(o => o.paymentStatus === 'REFUND_PENDING').length,
                refundedCount: orders.filter(o => o.paymentStatus === 'REFUNDED').length,
            };

            res.json({ orders, stats });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    },

    requestRefund: async (req: Request, res: Response) => {
        try {
            const { orderId, reason, userId } = req.body;

            // 1. Cari data order terlebih dahulu untuk mendapatkan nominal totalAmount
            const order = await prisma.order.findUnique({
                where: { id: orderId }
            });

            if (!order) {
                return res.status(404).json({ message: "Order tidak ditemukan" });
            }

            if (order.paymentStatus !== 'PAID') {
                return res.status(400).json({ message: "Hanya pesanan PAID yang bisa diajukan refund" });
            }

            await prisma.$transaction([
                prisma.refundRequest.create({
                    data: { 
                        orderId: orderId, 
                        reason: reason, 
                        requestedById: userId,
                        amount: order.totalAmount // WAJIB ADA: Berdasarkan skema anda amount adalah Decimal
                    }
                }),
                prisma.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: 'REFUND_PENDING' }
                })
            ]);

            res.json({ success: true, message: "Permintaan refund dikirim ke Manager" });
        } catch (error: any) {
            console.error(error);
            res.status(400).json({ message: "Gagal mengajukan refund" });
        }
    },

    handleRefund: async (req: Request, res: Response) => {
        try {
            const { orderId, action, managerId } = req.body;

            if (action === 'APPROVE') {
                await prisma.$transaction([
                    prisma.refundRequest.update({
                        where: { orderId: orderId },
                        data: { 
                            status: 'APPROVED', 
                            approvedById: managerId 
                        }
                    }),
                    prisma.order.update({
                        where: { id: orderId },
                        data: { 
                            paymentStatus: 'REFUNDED', 
                            status: 'CANCELLED' 
                        }
                    })
                ]);
            } else {
                await prisma.$transaction([
                    prisma.refundRequest.update({
                        where: { orderId: orderId },
                        data: { status: 'REJECTED' }
                    }),
                    prisma.order.update({
                        where: { id: orderId },
                        data: { paymentStatus: 'PAID' }
                    })
                ]);
            }

            res.json({ success: true });
        } catch (error: any) {
            console.error(error);
            res.status(400).json({ message: "Gagal memproses refund" });
        }
    }
};