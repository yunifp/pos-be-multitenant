// src/routes/role.routes.ts
import { Router } from "express";
import {
  getPermissions,
  getRoles,
  getRoleById,
} from "../controllers/role.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();
router.use(verifyToken);

router.get("/", requirePermission("ROLES_READ"), getRoles);
router.get("/permissions/:id", requirePermission("ROLES_READ"), getRoleById);

export default router;
