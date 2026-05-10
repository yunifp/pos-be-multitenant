// src/routes/category.routes.ts
import { Router } from "express";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validations/category.validation";

const router = Router();

// Semua route kategori harus terautentikasi
router.use(verifyToken);

// Daftar endpoints
router.get("/", requirePermission("INVENTORY_READ"), getCategories);
router.get("/:id", requirePermission("INVENTORY_READ"), getCategoryById);
router.post(
  "/",
  requirePermission("INVENTORY_CREATE"),
  validate(createCategorySchema),
  createCategory,
);
router.put(
  "/:id",
  requirePermission("INVENTORY_UPDATE"),
  validate(updateCategorySchema),
  updateCategory,
);
router.delete("/:id", requirePermission("INVENTORY_DELETE"), deleteCategory);

export default router;
