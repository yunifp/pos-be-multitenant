import { z } from "zod";
import { RefundStatus } from "@prisma/client";

export const createRefundSchema = z.object({
  orderId: z.string().uuid("ID Order tidak valid"),
  reason: z.string().min(5, "Alasan refund minimal 5 karakter"),
  amount: z.number().positive("Nominal refund harus lebih dari 0"),
});

export const processRefundSchema = z.object({
  status: z.enum([RefundStatus.APPROVED, RefundStatus.REJECTED]),
});
