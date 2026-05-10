import { z } from "zod";

export const updateSettingSchema = z.object({
  appName: z.string().min(1, "Nama aplikasi wajib diisi").optional(),
  storeName: z.string().min(1, "Nama toko wajib diisi").optional(),
  taxRate: z.number().min(0, "Pajak tidak boleh minus").optional(),
  serviceChargeRate: z
    .number()
    .min(0, "Service charge tidak boleh minus")
    .optional(),
  currencySymbol: z.string().optional(),
});
