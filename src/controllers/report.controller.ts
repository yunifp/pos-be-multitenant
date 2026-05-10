// src/controllers/report.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./member.controller";
import { CashFlowType, OrderStatus, PaymentStatus } from "@prisma/client";

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const branchId = req.query.branchId as string; // Filter opsional

    const branchFilter = branchId ? { id: branchId } : { tenantId };

    // Set waktu mulai hari ini pukul 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total Penjualan & Jumlah Order Hari Ini
    // PENYESUAIAN: Menambahkan agregasi untuk subtotal, tax, dan paymentFee (MDR)
    const orderStats = await prisma.order.aggregate({
      where: {
        branch: branchFilter,
        createdAt: { gte: today },
        paymentStatus: PaymentStatus.PAID,
      },
      _sum: {
        totalAmount: true,
        subtotal: true,
        tax: true,
        paymentFee: true, // Menarik total biaya MDR/Layanan hari ini
      },
      _count: { id: true },
    });

    // 2. Arus Kas (Pendapatan vs Pengeluaran) Hari Ini
    const cashFlows = await prisma.cashFlow.findMany({
      where: { branch: branchFilter, date: { gte: today } },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    cashFlows.forEach((cf) => {
      const amount = Number(cf.amount);
      if (
        cf.type === CashFlowType.INCOME_SALES ||
        cf.type === CashFlowType.INCOME_OTHER
      ) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        todayRevenue: Number(orderStats._sum.totalAmount || 0), // Omzet Kotor (Termasuk Pajak & Fee)
        todaySubtotal: Number(orderStats._sum.subtotal || 0), // Omzet Murni (Hanya Harga Barang)
        todayTax: Number(orderStats._sum.tax || 0), // Total Pajak Terkumpul
        todayPaymentFee: Number(orderStats._sum.paymentFee || 0), // Total Potongan Biaya Layanan/MDR
        todayOrders: orderStats._count.id,
        netCashflowToday: totalIncome - totalExpense,
        totalIncome,
        totalExpense,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal memuat dashboard" });
  }
};

export const getSalesReport = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { startDate, endDate, branchId } = req.query;

    const filter: any = {
      branch: branchId ? { id: branchId as string, tenantId } : { tenantId },
      paymentStatus: PaymentStatus.PAID,
    };

    if (startDate && endDate) {
      filter.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // PENYESUAIAN: Melampirkan detail item agar laporan penjualan bisa dibedah hingga ke level varian produk
    const sales = await prisma.order.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      include: {
        cashier: { select: { fullName: true } },
        items: {
          include: {
            variant: {
              select: { name: true, product: { select: { name: true } } },
            },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal memuat laporan penjualan" });
  }
};
