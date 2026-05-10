// src/routes/branch.routes.ts
import { Router } from "express";
import {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../controllers/branch.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createBranchSchema,
  updateBranchSchema,
} from "../validations/branch.validation";

const router = Router();

// Semua akses ke route cabang mewajibkan token JWT
router.use(verifyToken);

// Daftar Endpoints
router.get("/", requirePermission("BRANCH_READ"), getBranches as any);
router.get("/:id", requirePermission("BRANCH_READ"), getBranchById as any);
router.post(
  "/",
  requirePermission("BRANCH_CREATE"),
  validate(createBranchSchema),
  createBranch as any,
);
router.put(
  "/:id",
  requirePermission("BRANCH_UPDATE"),
  validate(updateBranchSchema),
  updateBranch as any,
);
router.delete("/:id", requirePermission("BRANCH_DELETE"), deleteBranch as any);

export default router;
