// src/routes/role.routes.ts
import { Router } from "express";
import {
  getPermissions,
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/role.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();
router.use(verifyToken);

router.get("/permissions", requirePermission("ROLES_READ"), getPermissions);
router.get("/", requirePermission("ROLES_READ"), getRoles);
router.get("/:id", requirePermission("ROLES_READ"), getRoleById);
router.post("/", requirePermission("ROLES_CREATE"), createRole);
router.put("/:id", requirePermission("ROLES_UPDATE"), updateRole);
router.delete("/:id", requirePermission("ROLES_DELETE"), deleteRole);

export default router;
