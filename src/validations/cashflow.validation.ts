import { z } from "zod";
import { CashFlowType } from "@prisma/client";

export const createCashFlowSchema = z.object({
  branchId: z.string().uuid(),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  type: z.nativeEnum(CashFlowType),
  category: z
    .string()
    .min(2, "Kategori wajib diisi (cth: Bayar Listrik, Kasbon)"),
  description: z.string().optional(),
});
