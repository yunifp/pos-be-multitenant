// src/routes/report.routes.ts
import { Router } from "express";
import {
  getDashboardStats,
  getSalesReport,
} from "../controllers/report.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();
router.use(verifyToken);
// Dashboard ringan (Real-time data)
router.get(
  "/dashboard",
  requirePermission("REPORT_READ"),
  getDashboardStats as any,
);
// Laporan Penjualan mendetail
router.get("/sales", requirePermission("REPORT_READ"), getSalesReport as any);

export default router;
