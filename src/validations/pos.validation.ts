// src/validations/pos.validation.ts
import { z } from "zod";
import { OrderType, PaymentStatus } from "@prisma/client";

const orderItemSchema = z.object({
  variantId: z.number().int(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  orderType: z.nativeEnum(OrderType).default("DINE_IN"),
  customerName: z.string().optional(),

  // Menggunakan ID referensi ke BranchPaymentMethod, atau fallback string manual
  paymentMethodId: z
    .string()
    .uuid("ID Metode Pembayaran tidak valid")
    .optional(),
  paymentMethod: z.string().optional(),

  paymentStatus: z.nativeEnum(PaymentStatus).default("UNPAID"),
  items: z
    .array(orderItemSchema)
    .min(1, "Keranjang belanja tidak boleh kosong"),
});

export const updateOrderStatusSchema = z.object({
  status: z
    .enum(["PENDING", "COOKING", "READY", "COMPLETED", "CANCELLED"])
    .optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),

  paymentMethodId: z.string().uuid().optional(),
  paymentMethod: z.string().optional(),
});
