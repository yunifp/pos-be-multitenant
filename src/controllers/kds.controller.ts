import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const kdsController = {
    getQueue: async (req: Request, res: Response) => {
        const { branchId } = req.query;
        
        if (!branchId) return res.status(400).json({ message: "Branch ID diperlukan" });

        try {
            const queue = await prisma.order.findMany({
                where: {
                    branchId: String(branchId),
                    status: { in: ['PENDING', 'COOKING', 'READY'] },
                    // Logika Filter Status Pembayaran berdasarkan OrderType
                    OR: [
                        {
                            // Kondisi 1: Jika via platform, wajib PAID
                            paymentMethod: 'MIDTRANS',
                            paymentStatus: 'PAID'
                        },
                        {
                            // Kondisi 2: Selain via platform, boleh PAID atau UNPAID
                            paymentMethod: { not: 'MIDTRANS' },
                            paymentStatus: { in: ['PAID', 'UNPAID'] }
                        }
                    ]
                },
                include: {
                    items: {
                        include: {
                            variant: { 
                                include: { product: true } 
                            }
                        }
                    },
                    cashier: { select: { fullName: true } }
                },
                orderBy: { createdAt: 'asc' } // FIFO
            });
            
            res.json(queue);
        } catch (error: any) {
            console.error("KDS Error:", error);
            res.status(500).json({ message: error.message });
        }
    },

    toggleItemReady: async (req: Request, res: Response) => {
        const { itemId, isReady } = req.body;
        try {
            const updatedItem = await prisma.orderItem.update({
                where: { id: itemId },
                data: { isReady: Boolean(isReady) },
                include: { order: true }
            });

            // Jika status masih PENDING dan ada item yang dicentang, ubah ke COOKING
            if (updatedItem.isReady && updatedItem.order.status === 'PENDING') {
                await prisma.order.update({
                    where: { id: updatedItem.orderId },
                    data: { status: 'COOKING' }
                });
            }
            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    },

    updateOrderStatus: async (req: Request, res: Response) => {
        const { orderId, status } = req.body;
        try {
            await prisma.$transaction(async (tx) => {
                // 1. Update status order dan ambil data terbarunya
                const updatedOrder = await tx.order.update({
                    where: { id: orderId },
                    data: { status }
                });

                // 2. Ambil General Settings untuk perhitungan poin
                const settings = await tx.generalSetting.findFirst();

                // 3. Logika Penambahan Poin (Khusus Cash/Manual & status COMPLETED)
                if (updatedOrder.paymentMethod === 'MIDTRANS' && status === 'COMPLETED') {
                    const memberId = updatedOrder.memberId;
                    
                    if (memberId && settings?.isActive) {
                        const totalForPoints = Number(updatedOrder.totalAmount);
                        
                        if (totalForPoints >= (settings.minOrderToEarn || 0)) {
                            const earned = Math.floor(totalForPoints / (settings.pointsPerAmount || 10000)) * (settings.pointsEarned || 1);
                            
                            if (earned > 0) {
                                // Tambah poin ke member
                                await tx.member.update({
                                    where: { id: memberId },
                                    data: { points: { increment: earned } }
                                });

                                // Catat riwayat poin
                                await tx.memberPointHistory.create({
                                    data: {
                                        memberId: memberId,
                                        orderId: updatedOrder.id,
                                        type: 'EARNED',
                                        amount: earned,
                                        description: `Poin belanja invoice ${updatedOrder.invoiceNumber}`
                                    }
                                });
                            }
                        }
                    }
                }
            });

            res.json({ success: true });
        } catch (error: any) {
            console.error("Update Status Error:", error.message);
            res.status(400).json({ message: error.message });
        }
    }
};