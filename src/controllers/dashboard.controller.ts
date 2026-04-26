import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format, getHours } from 'date-fns';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Ambil data user dari Token (Middleware auth)
    const user = (req as any).user;
    const { branchId, role } = user;
    
    // Range Waktu Hari Ini
    const startToday = startOfDay(new Date());
    const endToday = endOfDay(new Date());

    // --- 1. DATA UMUM: HOURLY TRAFFIC (Untuk Heatmap) ---
    // (Digunakan oleh Owner & Manager untuk melihat jam sibuk)
    let hourlyOrders = [];
    if (role === Role.OWNER) {
        // Owner lihat semua order
        hourlyOrders = await prisma.order.findMany({
            where: { createdAt: { gte: startToday, lte: endToday }, status: 'COMPLETED' },
            select: { createdAt: true }
        });
    } else {
        // Manager/Cashier hanya lihat order di cabangnya
        hourlyOrders = await prisma.order.findMany({
            where: { 
                branchId: branchId,
                createdAt: { gte: startToday, lte: endToday }, 
                status: 'COMPLETED' 
            },
            select: { createdAt: true }
        });
    }

    // Proses array 0-23 jam
    const hourlyTraffic = new Array(24).fill(0);
    hourlyOrders.forEach(order => {
        const hour = getHours(order.createdAt);
        hourlyTraffic[hour]++;
    });


    // ==========================================
    // LOGIKA A: OWNER (SUPER ADMIN)
    // ==========================================
    if (role === Role.OWNER) {
      
      // 1. Total Revenue Global (Hari Ini)
      const revenueGlobal = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: startToday, lte: endToday },
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      // 2. Statistik Per Cabang (Branch Performance)
      const branches = await prisma.branch.findMany({
          include: {
              orders: {
                  where: { 
                      createdAt: { gte: startToday, lte: endToday },
                      status: 'COMPLETED', 
                      paymentStatus: 'PAID'
                  },
                  select: { totalAmount: true }
              }
          }
      });

      // Map & Sort cabang berdasarkan Revenue tertinggi
      const branchPerformance = branches.map(b => ({
          id: b.id,
          name: b.name,
          revenue: b.orders.reduce((acc, curr) => acc + Number(curr.totalAmount), 0),
          txCount: b.orders.length
      })).sort((a, b) => b.revenue - a.revenue);

      // 3. Grafik Tren 7 Hari Terakhir (Global)
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const daily = await prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            createdAt: { gte: startOfDay(date), lte: endOfDay(date) },
            status: 'COMPLETED', 
            paymentStatus: 'PAID'
          }
        });
        chartData.push({ 
            date: format(date, 'dd/MM'), 
            amount: Number(daily._sum.totalAmount) || 0 
        });
      }

      // 4. Top 5 Produk Terlaris (Global)
      const topProductsRaw = await prisma.orderItem.groupBy({
        by: ['variantId'],
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
        where: { order: { status: 'COMPLETED' } }
      });

      const topProducts = await Promise.all(topProductsRaw.map(async (item) => {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true }
        });
        return {
          name: variant ? `${variant.product.name} (${variant.name})` : 'Unknown Product',
          qty: item._sum.quantity,
          sales: item._sum.subtotal
        };
      }));

      return res.json({
        type: 'OWNER_VIEW',
        summary: {
          revenue: Number(revenueGlobal._sum.totalAmount) || 0,
          totalBranches: branches.length,
          activeBranches: branchPerformance.filter(b => b.revenue > 0).length
        },
        branchPerformance,
        chart: chartData,
        topProducts,
        hourlyTraffic
      });
    }


    // ==========================================
    // LOGIKA B: MANAGER (MIRIP OWNER TAPI 1 CABANG)
    // ==========================================
    if (role === Role.MANAGER) {
        
        // 1. Revenue Cabang Ini
        const revenueBranch = await prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: {
                branchId: branchId,
                createdAt: { gte: startToday, lte: endToday },
                status: 'COMPLETED', paymentStatus: 'PAID'
            }
        });

        const txCount = await prisma.order.count({
            where: { branchId: branchId, createdAt: { gte: startToday, lte: endToday }, status: 'COMPLETED' }
        });

        // 2. Chart Cabang Ini (7 Hari)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const daily = await prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    branchId: branchId,
                    createdAt: { gte: startOfDay(date), lte: endOfDay(date) },
                    status: 'COMPLETED', paymentStatus: 'PAID'
                }
            });
            chartData.push({ 
                date: format(date, 'dd/MM'), 
                amount: Number(daily._sum.totalAmount) || 0 
            });
        }

        // 3. Top Products Cabang Ini
        const topProductsRaw = await prisma.orderItem.groupBy({
            by: ['variantId'],
            _sum: { quantity: true, subtotal: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
            where: { 
                order: { branchId: branchId, status: 'COMPLETED' } 
            }
        });

        const topProducts = await Promise.all(topProductsRaw.map(async (item) => {
            const variant = await prisma.productVariant.findUnique({
                where: { id: item.variantId },
                include: { product: true }
            });
            return {
                name: variant ? `${variant.product.name} (${variant.name})` : 'Unknown',
                qty: item._sum.quantity,
                sales: item._sum.subtotal
            };
        }));

        return res.json({
            type: 'OWNER_VIEW', // Manager pakai struktur UI yang sama dengan Owner
            summary: {
                revenue: Number(revenueBranch._sum.totalAmount) || 0,
                transactions: txCount,
                avgBasketSize: txCount > 0 ? (Number(revenueBranch._sum.totalAmount) / txCount) : 0
            },
            chart: chartData,
            topProducts,
            hourlyTraffic,
            branchPerformance: [] // Kosong karena Manager cuma pegang 1 cabang
        });
    }


    // ==========================================
    // LOGIKA C: CASHIER (SHIFT & SALES PRIBADI)
    // ==========================================
    if (role === Role.CASHIER) {
        
        // 1. Info Shift Hari Ini
        const myShift = await prisma.employeeShift.findFirst({
            where: {
                userId: user.id,
                date: { gte: startToday, lte: endToday }
            },
            include: { shift: true }
        });

        // 2. Penjualan Pribadi (My Sales)
        const mySales = await prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: {
                cashierId: user.id,
                createdAt: { gte: startToday },
                status: 'COMPLETED',
                paymentStatus: 'PAID'
            }
        });

        const myTxCount = await prisma.order.count({
            where: { cashierId: user.id, createdAt: { gte: startToday } }
        });

        return res.json({
            type: 'CASHIER_VIEW',
            shiftName: myShift?.shift.name || 'Tidak ada jadwal shift',
            shiftTime: myShift ? `${myShift.shift.startTime} - ${myShift.shift.endTime}` : '-',
            myTotalSales: Number(mySales._sum.totalAmount) || 0,
            transactionCount: myTxCount,
            // Kasir tidak perlu lihat chart toko/hourly traffic detail
        });
    }

    return res.status(403).json({ message: 'Role not authorized for dashboard' });

  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({ message: 'Error fetching dashboard data' });
  }
};