// src/controllers/pos.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  CashFlowType,
  OrderStatus,
  PaymentStatus,
  PaymentChannel,
} from "@prisma/client";
import crypto from "crypto";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// [POST] Buat Transaksi (Checkout)
export const createOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const cashierId = req.user!.id;
    const {
      branchId,
      orderType,
      customerName,
      paymentMethod,
      paymentMethodId,
      paymentStatus,
      items,
    } = req.body;

    // 1. Ambil setting pajak perusahaan
    const setting = await prisma.generalSetting.findUnique({
      where: { tenantId },
    });
    const taxRate = setting ? Number(setting.taxRate) : 0;

    // 2. Kumpulkan ID Varian yang dibeli untuk mengambil harga dan Resep (BOM)
    const variantIds = items.map((item: any) => item.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { recipes: true },
    });

    if (variants.length !== variantIds.length) {
      res
        .status(400)
        .json({
          success: false,
          message: "Beberapa produk dalam keranjang tidak valid",
        });
      return;
    }

    // 3. Kalkulasi Subtotal & Kebutuhan Bahan Baku
    let subtotal = 0;
    const orderItemsData: any[] = [];
    const requiredMaterials = new Map<string, number>();

    for (const item of items) {
      const variant = variants.find((v) => v.id === item.variantId)!;
      const itemSubtotal = Number(variant.price) * item.quantity;
      subtotal += itemSubtotal;

      orderItemsData.push({
        variantId: variant.id,
        quantity: item.quantity,
        price: variant.price,
        subtotal: itemSubtotal,
      });

      // Kalkulasi kebutuhan bahan baku berdasarkan resep
      for (const recipe of variant.recipes) {
        const totalRequired = Number(recipe.quantityRequired) * item.quantity;
        const currentNeeded = requiredMaterials.get(recipe.materialId) || 0;
        requiredMaterials.set(recipe.materialId, currentNeeded + totalRequired);
      }
    }

    const taxAmount = (subtotal * taxRate) / 100;

    // 4. Kalkulasi Payment Fee dari Branch Payment Method
    let paymentFee = 0;
    let finalPaymentMethodName: string | null = paymentMethod || null;

    // FIX: Deklarasi tipe eksplisit agar TypeScript tidak mengunci ke "BASIC"
    let finalPaymentChannel: PaymentChannel = PaymentChannel.BASIC;

    if (paymentMethodId) {
      const bpm = await prisma.branchPaymentMethod.findUnique({
        where: { id: paymentMethodId },
      });

      if (!bpm || bpm.branchId !== branchId) {
        res
          .status(400)
          .json({
            success: false,
            message: "Metode pembayaran tidak valid untuk cabang ini",
          });
        return;
      }

      finalPaymentMethodName = bpm.name;
      finalPaymentChannel = bpm.channel;

      // Hitung Fee (Persentase dari Subtotal + Biaya Flat)
      const feePct = (subtotal * Number(bpm.feePercentage)) / 100;
      paymentFee = feePct + Number(bpm.feeFlat);
    }

    const totalAmount = subtotal + taxAmount + paymentFee;
    const invoiceNumber = `INV-${new Date().getTime()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    // 5. Buka Transaksi Database
    const order = await prisma.$transaction(async (tx) => {
      // 5a. Pengecekan & Pengurangan Stok Bahan Baku Cabang
      for (const [materialId, requiredQty] of requiredMaterials.entries()) {
        const branchStock = await tx.branchMaterialStock.findUnique({
          where: { branchId_materialId: { branchId, materialId } },
        });

        // Strict mode: Tolak jika stok bahan baku tidak cukup
        if (!branchStock || Number(branchStock.quantity) < requiredQty) {
          throw new Error(
            `Stok bahan baku tidak mencukupi untuk memproses pesanan ini.`,
          );
        }

        await tx.branchMaterialStock.update({
          where: { branchId_materialId: { branchId, materialId } },
          data: { quantity: { decrement: requiredQty } },
        });
      }

      // 5b. Buat Order
      const newOrder = await tx.order.create({
        data: {
          branchId,
          cashierId,
          invoiceNumber,
          subtotal,
          tax: taxAmount,
          paymentFee,
          paymentMethod: finalPaymentMethodName,
          paymentChannel: finalPaymentChannel,
          totalAmount,
          paymentStatus,
          status: OrderStatus.PENDING,
          orderType,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      // 5c. Jika langsung lunas, catat ke CashFlow (Buku Kas)
      if (paymentStatus === PaymentStatus.PAID) {
        await tx.cashFlow.create({
          data: {
            branchId,
            amount: totalAmount,
            type: CashFlowType.INCOME_SALES,
            category: "Penjualan POS",
            description: `Invoice: ${invoiceNumber} | Metode: ${finalPaymentMethodName || "Manual"}`,
            referenceId: newOrder.id,
            recordedBy: cashierId,
          },
        });
      }

      return newOrder;
    });

    res
      .status(201)
      .json({
        success: true,
        data: order,
        message: "Pesanan berhasil diproses",
      });
  } catch (error: any) {
    res
      .status(400)
      .json({
        success: false,
        message: error.message || "Gagal memproses pesanan",
      });
  }
};

// [GET] Riwayat Transaksi (POS / Antrean Dapur)
export const getOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string;
    const status = req.query.status as OrderStatus;

    const filter: any = { branch: { tenantId: req.user!.tenantId } };
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;

    const orders = await prisma.order.findMany({
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

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update Status Pesanan (Dapur Selesai / Pelanggan Bayar Tagihan)
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const orderId = req.params.id;
    const { status, paymentStatus, paymentMethod, paymentMethodId } = req.body;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!existingOrder) {
      res
        .status(404)
        .json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      let updatedPaymentMethod =
        paymentMethod !== undefined
          ? paymentMethod
          : existingOrder.paymentMethod;

      // FIX: Deklarasi tipe eksplisit
      let updatedPaymentChannel: PaymentChannel = existingOrder.paymentChannel;

      let updatedPaymentFee = Number(existingOrder.paymentFee);
      let updatedTotalAmount = Number(existingOrder.totalAmount);

      // Jika kasir memilih metode bayar saat melunasi Open Bill
      if (paymentMethodId) {
        const bpm = await tx.branchPaymentMethod.findUnique({
          where: { id: paymentMethodId },
        });

        if (bpm) {
          updatedPaymentMethod = bpm.name;
          updatedPaymentChannel = bpm.channel;

          // Kalkulasi ulang fee dari subtotal asli pesanan
          const subtotal = Number(existingOrder.subtotal);
          const feePct = (subtotal * Number(bpm.feePercentage)) / 100;
          updatedPaymentFee = feePct + Number(bpm.feeFlat);

          // Kalkulasi ulang Total Amount
          updatedTotalAmount =
            subtotal + Number(existingOrder.tax) + updatedPaymentFee;
        }
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          paymentStatus,
          paymentMethod: updatedPaymentMethod,
          paymentChannel: updatedPaymentChannel,
          paymentFee: updatedPaymentFee,
          totalAmount: updatedTotalAmount,
        },
      });

      // Jika sebelumnya UNPAID dan sekarang di-update jadi PAID, catat ke Kas
      if (
        existingOrder.paymentStatus !== PaymentStatus.PAID &&
        paymentStatus === PaymentStatus.PAID
      ) {
        await tx.cashFlow.create({
          data: {
            branchId: order.branchId,
            amount: order.totalAmount,
            type: CashFlowType.INCOME_SALES,
            category: "Pelunasan Tagihan",
            description: `Invoice: ${order.invoiceNumber} | Metode: ${order.paymentMethod || "Manual"}`,
            referenceId: order.id,
            recordedBy: req.user!.id,
          },
        });
      }
      return order;
    });

    res
      .status(200)
      .json({
        success: true,
        data: updatedOrder,
        message: "Status pesanan diperbarui",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal mengupdate pesanan", error });
  }
};
