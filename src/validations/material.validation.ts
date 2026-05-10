// src/validations/material.validation.ts
import { z } from "zod";

export const createMaterialSchema = z.object({
  name: z.string().min(2, "Nama bahan baku minimal 2 karakter"),
  unit: z.string().min(1, "Satuan wajib diisi (cth: Gram, Liter, Pcs)"),
  costPerUnit: z.number().min(0, "Harga (HPP) tidak boleh minus"),
});

// Partial membuat semua field di atas menjadi opsional untuk proses Update
export const updateMaterialSchema = createMaterialSchema.partial();
