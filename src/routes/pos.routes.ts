import { Router } from "express";
import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/pos.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validations/pos.validation";

const router = Router();

router.use(verifyToken);

// [POST] Checkout Pesanan
router.post(
  "/",
  requirePermission("ORDER_CREATE"),
  validate(createOrderSchema),
  createOrder as any,
);

// [GET] Riwayat Pesanan & Antrean (Bisa difilter via Query Params ?status=PENDING)
router.get("/", requirePermission("ORDER_READ"), getOrders as any);

// [PATCH] Update Status Masakan / Status Pembayaran
router.patch(
  "/:id/status",
  requirePermission("ORDER_UPDATE"),
  validate(updateOrderStatusSchema),
  updateOrderStatus as any,
);

export default router;
