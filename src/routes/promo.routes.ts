// src/routes/promo.routes.ts
import { Router } from "express";
import {
  createPromotion,
  getPromotions,
} from "../controllers/promo.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPromoSchema } from "../validations/promo.validation";

const router = Router();
router.use(verifyToken);
router.get("/", requirePermission("PROMO_READ"), getPromotions as any);
router.post(
  "/",
  requirePermission("PROMO_CREATE"),
  validate(createPromoSchema),
  createPromotion as any,
);

export default router;
