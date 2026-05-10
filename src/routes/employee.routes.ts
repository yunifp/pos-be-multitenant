// src/routes/employee.routes.ts
import { Router } from "express";
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employee.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "../validations/employee.validation";

const router = Router();

// Wajib Login
router.use(verifyToken);

// Daftar Endpoints
router.get("/", requirePermission("EMPLOYEE_READ"), getEmployees as any);
router.get("/:id", requirePermission("EMPLOYEE_READ"), getEmployeeById as any);
router.post(
  "/",
  requirePermission("EMPLOYEE_CREATE"),
  validate(createEmployeeSchema),
  createEmployee as any,
);
router.put(
  "/:id",
  requirePermission("EMPLOYEE_UPDATE"),
  validate(updateEmployeeSchema),
  updateEmployee as any,
);
router.delete(
  "/:id",
  requirePermission("EMPLOYEE_DELETE"),
  deleteEmployee as any,
);

export default router;
