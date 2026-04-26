import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, orderType, paymentMethod, branchId, search } = req.query;

    // 1. Build Filter Clause
    let whereClause: any = {
      status: 'COMPLETED',
    };

    // Logika Filter Cabang: Jika branchId adalah 'all' atau undefined (khusus owner), jangan filter branchId
    if (branchId && branchId !== 'all') {
        whereClause.branchId = branchId as string;
    }
    
    if (orderType && orderType !== 'ALL') whereClause.orderType = orderType as any;
    if (paymentMethod && paymentMethod !== 'ALL') whereClause.paymentMethod = paymentMethod as any;
    
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt = { gte: start, lte: end };
    }

    if (search) {
      whereClause.OR = [
        { invoiceNumber: { contains: search as string, mode: 'insensitive' } },
        { customerName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [summary, byMethod, byType, orders] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
        where: whereClause,
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        _sum: { totalAmount: true },
        where: whereClause,
      }),
      prisma.order.groupBy({
        by: ['orderType'],
        _sum: { totalAmount: true },
        where: whereClause,
      }),
      prisma.order.findMany({
        where: whereClause,
        include: {
          cashier: { select: { fullName: true } },
          member: { select: { name: true } },
          appliedPromotions: {
            include: { promotion: { select: { name: true, type: true } } }
          },
          items: {
            include: {
              variant: { 
                select: { 
                  name: true, 
                  hpp: true, 
                  product: { select: { name: true } } 
                } 
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let totalHpp = 0;
    let totalItemDiscounts = 0;

    orders.forEach((order) => {
      order.items.forEach((item) => {
        totalHpp += Number(item?.hpp || 0) * item.quantity;
        totalItemDiscounts += Number(item.discount || 0);
      });
    });

    return res.json({
      stats: {
        totalOmzet: summary._sum.totalAmount || 0,
        totalHpp: totalHpp,
        totalTransactions: summary._count.id,
        totalItemDiscounts,
        breakdownMethod: byMethod,
        breakdownType: byType,
      },
      data: orders,
    });
  } catch (error) {
    console.error("Sales Report Error:", error);
    return res.status(500).json({ message: "Gagal mengambil laporan penjualan" });
  }
};