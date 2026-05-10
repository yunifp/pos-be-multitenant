import { z } from "zod";
import { PromotionType } from "@prisma/client";

export const createPromoSchema = z.object({
  name: z.string().min(3, "Nama promo minimal 3 karakter"),
  code: z.string().min(3, "Kode promo minimal 3 karakter"),
  type: z.nativeEnum(PromotionType),
  discountPct: z.number().min(0).max(100).optional().nullable(),
  discountAmt: z.number().min(0).optional().nullable(),
  minPurchase: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional().nullable(),
  startDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      "Format: YYYY-MM-DDTHH:mm:ssZ",
    ),
  endDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      "Format: YYYY-MM-DDTHH:mm:ssZ",
    ),
  isGlobal: z.boolean().default(false),
  branchIds: z.array(z.string().uuid()).optional(), // Jika tidak global, promo berlaku di cabang mana saja?
  targetVariantIds: z.array(z.number().int()).optional(), // Jika tipe PRODUCT_DISCOUNT
});
