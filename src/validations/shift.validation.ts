import { z } from "zod";
import { ShiftType } from "@prisma/client";

export const createShiftSchema = z.object({
  branchId: z.string().uuid("ID Cabang tidak valid"),
  name: z.string().min(2, "Nama shift minimal 2 karakter"),
  type: z.nativeEnum(ShiftType),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu salah (HH:MM)"),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu salah (HH:MM)"),
});

export const updateShiftSchema = createShiftSchema.partial();

export const assignShiftSchema = z.object({
  userId: z.string().uuid("ID User tidak valid"),
  shiftId: z.string().uuid("ID Shift tidak valid"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal salah (YYYY-MM-DD)"),
});
