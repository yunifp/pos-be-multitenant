// src/routes/tenant.routes.ts
import { Router } from "express";
import { checkTenantStatus } from "../controllers/tenant.controller";

const router = Router();

router.get("/verify", checkTenantStatus);

export default router;
