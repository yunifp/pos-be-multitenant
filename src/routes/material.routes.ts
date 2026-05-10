// src/routes/material.routes.ts
import { Router } from "express";
import {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from "../controllers/material.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createMaterialSchema,
  updateMaterialSchema,
} from "../validations/material.validation";

const router = Router();

// Semua route material harus melalui verifikasi token
router.use(verifyToken);

// Daftar endpoints
router.get("/", requirePermission("INVENTORY_READ"), getMaterials);
router.get("/:id", requirePermission("INVENTORY_READ"), getMaterialById);
router.post(
  "/",
  requirePermission("INVENTORY_CREATE"),
  validate(createMaterialSchema),
  createMaterial,
);
router.put(
  "/:id",
  requirePermission("INVENTORY_UPDATE"),
  validate(updateMaterialSchema),
  updateMaterial,
);
router.delete("/:id", requirePermission("INVENTORY_DELETE"), deleteMaterial);

export default router;
