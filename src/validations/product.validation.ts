// src/validations/product.validation.ts
import { z } from "zod";

const recipeSchema = z.object({
  materialId: z.string().uuid("ID Material tidak valid"),
  quantityRequired: z.number().positive("Kuantitas resep harus lebih dari 0"),
});

const variantSchema = z.object({
  name: z.string().min(1, "Nama varian wajib diisi (cth: Reguler, Ice)"),
  price: z.number().min(0, "Harga tidak boleh minus"),
  recipes: z.array(recipeSchema).optional(),
});

export const createProductSchema = z.object({
  categoryId: z.number().int("ID Kategori harus angka"),
  branchId: z.string().uuid().optional().nullable(),
  name: z.string().min(2, "Nama produk minimal 2 karakter"),
  variants: z.array(variantSchema).min(1, "Minimal harus ada 1 varian"),
});

// Skema untuk update (semua field opsional)
export const updateProductSchema = createProductSchema.partial();
