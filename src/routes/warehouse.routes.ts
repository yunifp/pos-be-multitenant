// src/routes/warehouse.routes.ts
import { Router } from "express";
import {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  addWarehouseStock,
  getDistributions,
  createDistribution,
  receiveDistribution,
} from "../controllers/warehouse.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  addStockSchema,
  createDistributionSchema,
} from "../validations/warehouse.validation";

const router = Router();

// Wajib Login
router.use(verifyToken);

// --- Endpoints Gudang Utama ---
router.get("/", requirePermission("INVENTORY_READ"), getWarehouses as any);
router.get(
  "/:id",
  requirePermission("INVENTORY_READ"),
  getWarehouseById as any,
);
router.post(
  "/",
  requirePermission("INVENTORY_CREATE"),
  validate(createWarehouseSchema),
  createWarehouse as any,
);
router.put(
  "/:id",
  requirePermission("INVENTORY_UPDATE"),
  validate(updateWarehouseSchema),
  updateWarehouse as any,
);
router.delete(
  "/:id",
  requirePermission("INVENTORY_DELETE"),
  deleteWarehouse as any,
);

// --- Endpoints Management Stok Gudang ---
// Endpoint untuk memasok barang ke Gudang dari Supplier
router.post(
  "/:id/stocks",
  requirePermission("INVENTORY_CREATE"),
  validate(addStockSchema),
  addWarehouseStock as any,
);

// --- Endpoints Distribusi Gudang -> Cabang ---
router.get(
  "/distributions/all",
  requirePermission("INVENTORY_READ"),
  getDistributions as any,
);
router.post(
  "/distributions",
  requirePermission("INVENTORY_CREATE"),
  validate(createDistributionSchema),
  createDistribution as any,
);

// Endpoint saat kasir/manager cabang menekan tombol "Terima Barang"
router.post(
  "/distributions/:id/receive",
  requirePermission("INVENTORY_UPDATE"),
  receiveDistribution as any,
);

export default router;
