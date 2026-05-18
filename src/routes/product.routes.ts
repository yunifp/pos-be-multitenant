// src/routes/product.routes.ts
import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  updateProductSchema,
} from "../validations/product.validation";

const router = Router();

// Wajib Login untuk mengakses modul ini
router.use(verifyToken);

// Daftar Endpoints
router.get("/", requirePermission("PRODUCT_READ"), getProducts as any);
router.get("/:id", requirePermission("PRODUCT_READ"), getProductById as any);
router.post(
  "/",
  requirePermission("PRODUCT_CREATE"),
  validate(createProductSchema),
  createProduct as any,
);
router.put(
  "/:id",
  requirePermission("PRODUCT_UPDATE"),
  validate(updateProductSchema),
  updateProduct as any,
);
router.delete(
  "/:id",
  requirePermission("PRODUCT_DELETE"),
  deleteProduct as any,
);

export default router;
