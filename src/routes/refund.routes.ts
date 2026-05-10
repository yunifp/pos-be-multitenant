// src/routes/refund.routes.ts
import { Router } from "express";
import {
  createRefundRequest,
  processRefund,
} from "../controllers/refund.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createRefundSchema,
  processRefundSchema,
} from "../validations/refund.validation";

const router = Router();
router.use(verifyToken);

// Kasir meminta Refund
router.post(
  "/request",
  requirePermission("ORDER_UPDATE"),
  validate(createRefundSchema),
  createRefundRequest as any,
);

// Manager / Owner Menyetujui Refund
router.patch(
  "/:id/process",
  requirePermission("FINANCE_UPDATE"),
  validate(processRefundSchema),
  processRefund as any,
);

export default router;
