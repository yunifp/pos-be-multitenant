// src/routes/auth.routes.ts
import { Router } from "express";
import { login, getMe, registerTenant } from "../controllers/auth.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", registerTenant);

router.get("/me", verifyToken, getMe);

export default router;
