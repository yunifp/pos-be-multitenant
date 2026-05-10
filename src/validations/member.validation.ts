import { z } from "zod";

export const createMemberSchema = z.object({
  branchId: z.string().uuid("ID Cabang tidak valid"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  phone: z.string().min(9, "Nomor HP tidak valid"),
  email: z.string().email("Email tidak valid").optional().nullable(),
});

export const updateMemberSchema = createMemberSchema.partial();

export const adjustPointSchema = z.object({
  amount: z.number(), // Bisa minus untuk mengurangi
  description: z.string().min(3, "Berikan alasan penyesuaian poin"),
});
