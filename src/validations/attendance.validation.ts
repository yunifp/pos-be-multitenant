import { z } from "zod";

export const clockInSchema = z.object({
  shiftStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  shiftEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  photoUrl: z.string().url().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
