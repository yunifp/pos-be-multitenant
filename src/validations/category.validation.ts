import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  isActive: z.boolean().optional(),
});

// Partial membuat semua field di atas menjadi opsional untuk proses Update
export const updateCategorySchema = createCategorySchema.partial();
