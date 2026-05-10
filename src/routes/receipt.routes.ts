import { Router } from "express";
import {
  getReceiptSetting,
  updateReceiptSetting,
} from "../controllers/receipt.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateReceiptSchema } from "../validations/receipt.validation";

const router = Router();

router.use(verifyToken);

// Menggunakan :branchId karena setting struk bersifat spesifik per cabang
router.get(
  "/:branchId",
  requirePermission("SETTINGS_READ"),
  getReceiptSetting as any,
);
router.put(
  "/:branchId",
  requirePermission("SETTINGS_UPDATE"),
  validate(updateReceiptSchema),
  updateReceiptSetting as any,
);

export default router;
