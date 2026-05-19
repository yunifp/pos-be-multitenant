// src/validations/product.validation.ts
import { z } from "zod";

// Skema untuk Resep / Bahan Baku
const recipeSchema = z.object({
  materialId: z.string().uuid("ID Material tidak valid"),
  quantityRequired: z.number().positive("Kuantitas resep harus lebih dari 0"),
});

// Skema untuk Varian Produk
const variantSchema = z.object({
  name: z.string().min(1, "Nama varian wajib diisi (cth: Reguler, Jumbo)"),
  price: z.number().min(0, "Harga varian tidak boleh minus"),
  trackStock: z.boolean().optional(),
  stock: z.number().min(0, "Stok tidak boleh minus").optional(),
  recipes: z.array(recipeSchema).optional(),
});

// Skema Utama Pembuatan Produk
export const createProductSchema = z
  .object({
    categoryId: z.number().int("ID Kategori harus angka"),
    branchId: z.string().uuid("ID Branch tidak valid").optional().nullable(),
    name: z.string().min(2, "Nama produk minimal 2 karakter"),

    hasVariant: z.boolean().default(false),

    // Field opsional di level root (karena bergantung pada hasVariant)
    price: z.number().min(0, "Harga produk tidak boleh minus").optional(),
    trackStock: z.boolean().optional(),
    stock: z.number().min(0, "Stok tidak boleh minus").optional(),

    recipes: z.array(recipeSchema).optional(),
    variants: z.array(variantSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // LOGIKA 1: JIKA PRODUK BERVARIAN
    if (data.hasVariant === true) {
      if (!data.variants || data.variants.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Produk dengan tipe varian wajib memiliki minimal 1 varian",
          path: ["variants"],
        });
      }
    }
    // LOGIKA 2: JIKA PRODUK TUNGGAL (TIDAK BERVARIAN)
    else {
      // Produk tunggal wajib menyertakan harga utama
      if (data.price === undefined || data.price === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Harga produk wajib diisi jika produk tidak memiliki varian",
          path: ["price"],
        });
      }
    }
  });

export const updateProductSchema = createProductSchema;
