import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(3, "Nama cabang minimal 3 karakter"),
  address: z.string().optional(),
  phone: z.string().optional(),
  enableOrderQueue: z.boolean().optional(),
});

export const updateBranchSchema = createBranchSchema.partial();
