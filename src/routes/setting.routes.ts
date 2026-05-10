import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/setting.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateSettingSchema } from "../validations/setting.validation";

const router = Router();

// Harus login dan punya akses mengubah pengaturan
router.get("/", verifyToken, getSettings);
router.put(
  "/",
  verifyToken,
  requirePermission("SETTINGS_UPDATE"),
  validate(updateSettingSchema),
  updateSettings,
);

export default router;
