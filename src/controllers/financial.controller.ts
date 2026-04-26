import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const prisma = new PrismaClient();

export const getFinancialAgregation = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user; // Ambil data user dari middleware auth
        const { branchId, startDate, endDate } = req.query;

        // 1. Logika Hak Akses & Filter Cabang
        let finalBranchFilter: any = {};

        if (user.role === 'OWNER') {
            // Owner bisa pilih spesifik cabang atau 'all' untuk semua cabang
            if (branchId && branchId !== 'all') {
                finalBranchFilter = { branchId: branchId as string };
            } else {
                finalBranchFilter = {}; // Kosongkan filter untuk mengambil SEMUA
            }
        } else {
            // Manager/Staff hanya boleh melihat cabang mereka sendiri
            finalBranchFilter = { branchId: user.branchId };
        }

        // 2. Setup Filter Tanggal yang Presisi
        // Menggunakan startOfDay dan endOfDay untuk memastikan seluruh jam dalam hari tersebut tercakup
        const start = startDate ? startOfDay(new Date(startDate as string)) : startOfDay(new Date());
        const end = endDate ? endOfDay(new Date(endDate as string)) : endOfDay(new Date());

        // 3. Query Data Secara Paralel dengan filter yang sudah diperbaiki
        const [orders, cashFlows] = await Promise.all([
            prisma.order.findMany({
                where: {
                    ...finalBranchFilter,
                    status: 'COMPLETED',
                    createdAt: { gte: start, lte: end }
                },
                include: { 
                    items: true, 
                    branch: { select: { name: true } } 
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.cashFlow.findMany({
                where: {
                    ...finalBranchFilter,
                    date: { gte: start, lte: end }
                },
                include: { 
                    branch: { select: { name: true } },
                    recorder: { select: { fullName: true } } 
                },
                orderBy: { date: 'desc' }
            })
        ]);

        // 4. Kalkulasi Stats (Gunakan Number() untuk akurasi Decimal Prisma)
        let totalOmzet = 0;
        let totalHpp = 0;
        let totalTax = 0;
        let totalService = 0;

        orders.forEach(o => {
            totalOmzet += Number(o.totalAmount || 0);
            totalTax += Number(o.tax || 0);
            totalService += Number(o.serviceCharge || 0);
            o.items.forEach(i => {
                // Pastikan field hpp ada di order_items saat POS melakukan checkout
                totalHpp += Number(i.hpp || 0) * i.quantity;
            });
        });

        const pendapatanNetto = totalOmzet - totalHpp; // Margin Penjualan Kotor

        const totalBelanja = cashFlows
            .filter(cf => cf.type === 'OPERATIONAL')
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        const totalKasMasuk = cashFlows
            .filter(cf => cf.type === 'INCOME')
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        const totalKasKeluar = cashFlows
            .filter(cf => cf.type === 'EXPENSE')
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        // --- RUMUS SESUAI PERMINTAAN ---
        // Saldo Akumulasi Profit: (Pendapatan - HPP) - Total Belanja Operasional
        const saldoAkumulasiProfit = pendapatanNetto - totalBelanja;

        // Saldo Kas Murni: (Uang Masuk Lainnya - Uang Keluar Lainnya)
        const saldoKasMurni = totalKasMasuk - totalKasKeluar;

        // Saldo Keseluruhan: Uang di tangan (Omzet) + Profit Bersih Riil
        const saldoKeseluruhan = saldoKasMurni + saldoAkumulasiProfit;

        // 5. Grouping Data untuk Grafik Tren Harian
        const chartMap = new Map();
        orders.forEach(curr => {
            const dateKey = curr.createdAt.toISOString().split('T')[0];
            const currentVal = chartMap.get(dateKey) || 0;
            chartMap.set(dateKey, currentVal + Number(curr.totalAmount));
        });

        const charts = Array.from(chartMap.entries()).map(([date, omzet]) => ({
            date,
            omzet
        })).sort((a, b) => a.date.localeCompare(b.date));

        // 6. Return Data
        res.json({
            summary: {
                totalOmzet,
                totalHpp,
                pendapatanNetto,
                totalBelanja,
                totalKasMasuk,
                totalKasKeluar,
                saldoAkumulasiProfit,
                saldoKasMurni,
                saldoKeseluruhan
            },
            tables: {
                orders,
                expenses: cashFlows.filter(cf => cf.type === 'OPERATIONAL'),
                cashFlows: cashFlows.filter(cf => cf.type !== 'OPERATIONAL')
            },
            charts
        });

    } catch (error: any) {
        console.error("Financial Error:", error);
        res.status(500).json({ message: "Gagal memproses laporan keuangan: " + error.message });
    }
};