// src/controllers/refund.controller.ts
import { Request, Response } from "express";
import { CashFlowType, PaymentStatus, RefundStatus } from "@prisma/client";

// Interface untuk mengatasi error TS 'req.user'
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// 1. Kasir Mengajukan Refund
export const createRefundRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const { orderId, reason, amount } = req.body;
    const requestedById = req.user!.id;

    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      res
        .status(404)
        .json({ success: false, message: "Order tidak ditemukan" });
      return;
    }

    const refund = await db.$transaction(async (tx) => {
      // Ubah status Order menjadi REFUND_PENDING
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.REFUND_PENDING },
      });

      return await tx.refundRequest.create({
        data: {
          orderId,
          requestedById,
          reason,
          amount,
          status: RefundStatus.PENDING,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: refund,
      message: "Pengajuan refund berhasil dikirim ke Manager",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal mengajukan refund" });
  }
};

// 2. Manager Memproses Refund (Approve/Reject)
export const processRefund = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const refundId = req.params.id;
    const { status } = req.body; // APPROVED / REJECTED
    const approvedById = req.user!.id;

    const refundReq = await db.refundRequest.findUnique({
      where: { id: refundId },
      include: { order: true },
    });

    if (!refundReq || refundReq.status !== RefundStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: "Refund tidak valid atau sudah diproses",
      });
      return;
    }

    await db.$transaction(async (tx) => {
      // 1. Update status tabel Refund
      await tx.refundRequest.update({
        where: { id: refundId },
        data: { status, approvedById },
      });

      // 2. Jika di-Approve, ubah status Order & catat pengurangan Kas
      if (status === RefundStatus.APPROVED) {
        await tx.order.update({
          where: { id: refundReq.orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });

        await tx.cashFlow.create({
          data: {
            branchId: refundReq.order.branchId,
            amount: refundReq.amount,
            type: CashFlowType.EXPENSE_OTHER, // Dicatat sebagai pengeluaran agar balance kas sesuai
            category: "Refund Penjualan",
            description: `Refund Order: ${refundReq.order.invoiceNumber} | Alasan: ${refundReq.reason}`,
            referenceId: refundReq.order.id,
            recordedBy: approvedById,
          },
        });
      } else {
        // Jika REJECTED, kembalikan status Order menjadi PAID
        await tx.order.update({
          where: { id: refundReq.orderId },
          data: { paymentStatus: PaymentStatus.PAID },
        });
      }
    });

    res
      .status(200)
      .json({ success: true, message: `Refund berhasil di-${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal memproses refund" });
  }
};
