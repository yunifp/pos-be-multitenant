// src/routes/member.routes.ts
import { Router } from "express";
import {
  createMember,
  getMembers,
  adjustPoints,
} from "../controllers/member.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createMemberSchema,
  adjustPointSchema,
} from "../validations/member.validation";

const router = Router();
router.use(verifyToken);
router.get("/", requirePermission("CRM_READ"), getMembers as any);
router.post(
  "/",
  requirePermission("CRM_CREATE"),
  validate(createMemberSchema),
  createMember as any,
);
router.post(
  "/:id/adjust-points",
  requirePermission("CRM_UPDATE"),
  validate(adjustPointSchema),
  adjustPoints as any,
);

export default router;
