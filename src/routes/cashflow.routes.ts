import { Router } from "express";
import {
  getCashFlows,
  createCashFlow,
} from "../controllers/cashflow.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCashFlowSchema } from "../validations/cashflow.validation";

const router = Router();

router.use(verifyToken);

// [GET] Lihat Mutasi Kas
router.get("/", requirePermission("FINANCE_READ"), getCashFlows as any);

// [POST] Catat Pengeluaran/Pemasukan Manual
router.post(
  "/",
  requirePermission("FINANCE_CREATE"),
  validate(createCashFlowSchema),
  createCashFlow as any,
);

export default router;
