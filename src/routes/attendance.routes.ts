// src/routes/attendance.routes.ts
import { Router } from "express";
import { clockIn, clockOut } from "../controllers/attendance.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { clockInSchema } from "../validations/attendance.validation";

const router = Router();
router.use(verifyToken); // Semua user yang login (kasir dll) berhak absen
router.post("/clock-in", validate(clockInSchema), clockIn as any);
router.post("/:id/clock-out", clockOut as any);

export default router;
