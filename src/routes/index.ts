import { Router } from "express";
import authRoutes from "./auth.routes";
import roleRoutes from "./role.routes";
import settingRoutes from "./setting.routes";
import branchRoutes from "./branch.routes";
import employeeRoutes from "./employee.routes";

import productRoutes from "./product.routes";
import categoryRoutes from "./category.routes";
import materialRoutes from "./material.routes";
import warehouseRoutes from "./warehouse.routes";

import posRoutes from "./pos.routes";
import receiptRoutes from "./receipt.routes";
import cashflowRoutes from "./cashflow.routes";

import shiftRoutes from "./shift.routes";
import attendanceRoutes from "./attendance.routes";
import refundRoutes from "./refund.routes";

import memberRoutes from "./member.routes";
import promoRoutes from "./promo.routes";
import reportRoutes from "./report.routes";
import tenantRoutes from "./tenant.routes";

const router = Router();

router.use("/tenant", tenantRoutes);
router.use("/auth", authRoutes);
router.use("/roles", roleRoutes);
router.use("/settings", settingRoutes);
router.use("/branches", branchRoutes);
router.use("/employees", employeeRoutes);

router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/materials", materialRoutes);
router.use("/warehouses", warehouseRoutes);

router.use("/pos/orders", posRoutes);
router.use("/receipts", receiptRoutes);
router.use("/finance/cashflows", cashflowRoutes);

router.use("/shifts", shiftRoutes);
router.use("/attendances", attendanceRoutes);
router.use("/refunds", refundRoutes);

router.use("/crm/members", memberRoutes);
router.use("/crm/promos", promoRoutes);
router.use("/reports", reportRoutes);

export default router;
