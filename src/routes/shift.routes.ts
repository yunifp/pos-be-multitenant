// src/routes/shift.routes.ts
import { Router } from "express";
import {
  createShift,
  getShifts,
  assignShift,
} from "../controllers/shift.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createShiftSchema,
  assignShiftSchema,
} from "../validations/shift.validation";

const router = Router();
router.use(verifyToken);
router.get("/", requirePermission("EMPLOYEE_READ"), getShifts as any);
router.post(
  "/",
  requirePermission("EMPLOYEE_CREATE"),
  validate(createShiftSchema),
  createShift as any,
);
router.post(
  "/assign",
  requirePermission("EMPLOYEE_UPDATE"),
  validate(assignShiftSchema),
  assignShift as any,
);

export default router;
