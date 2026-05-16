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

const router = Router();

// --- PERMISSIONS ---
// GET /api/v1/roles/permissions (Harus diletakkan sebelum /:id agar tidak terbaca sebagai parameter id)
router.get("/permissions", getPermissions);

// --- ROLES ---
// GET /api/v1/roles
router.get("/", getRoles);

// GET /api/v1/roles/:id
router.get("/:id", getRoleById);

// POST /api/v1/roles
router.post("/", createRole);

// PUT /api/v1/roles/:id
router.put("/:id", updateRole);

// DELETE /api/v1/roles/:id
router.delete("/:id", deleteRole);

export default router;
