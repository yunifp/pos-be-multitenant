// src/validations/employee.validation.ts
import { z } from "zod";
import { JobPosition } from "@prisma/client";

export const createEmployeeSchema = z.object({
  branchId: z.string().uuid("ID Cabang tidak valid").optional().nullable(),
  roleId: z.string().uuid("ID Role tidak valid"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  jobPosition: z.nativeEnum(JobPosition),
  isActive: z.boolean().optional(),
});

// Skema untuk Update (semua field opsional, termasuk password)
export const updateEmployeeSchema = z.object({
  branchId: z.string().uuid("ID Cabang tidak valid").optional().nullable(),
  roleId: z.string().uuid("ID Role tidak valid").optional(),
  email: z.string().email("Format email tidak valid").optional(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter").optional(),
  jobPosition: z.nativeEnum(JobPosition).optional(),
  isActive: z.boolean().optional(),
});
