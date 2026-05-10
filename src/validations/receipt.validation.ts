import { z } from "zod";
import { DocumentFormat } from "@prisma/client";

export const updateReceiptSchema = z.object({
  documentFormat: z.nativeEnum(DocumentFormat).optional(),
  invoicePrefix: z.string().optional().nullable(),
  dueDaysDefault: z.number().min(0).optional(),
  storeName: z.string().optional(),
  footerMessage: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  paperWidth: z.number().optional(),
});
