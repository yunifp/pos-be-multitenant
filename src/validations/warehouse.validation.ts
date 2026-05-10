// src/validations/warehouse.validation.ts
import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().min(3, "Nama gudang minimal 3 karakter"),
  address: z.string().optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const addStockSchema = z.object({
  materialId: z.string().uuid("ID Material tidak valid"),
  quantity: z.number().positive("Jumlah stok harus lebih dari 0"),
});

const distributionItemSchema = z.object({
  materialId: z.string().uuid("ID Material tidak valid"),
  quantity: z.number().positive("Kuantitas harus lebih dari 0"),
});

export const createDistributionSchema = z.object({
  sourceWarehouseId: z.string().uuid("ID Gudang Asal tidak valid"),
  destBranchId: z.string().uuid("ID Cabang Tujuan tidak valid"),
  notes: z.string().optional(),
  items: z
    .array(distributionItemSchema)
    .min(1, "Minimal 1 item bahan baku didistribusikan"),
});
