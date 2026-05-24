// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { generateInternalToken } from "../lib/internal-auth";
import { extractTenantSlug } from "./tenant.middleware";

// Extend Request agar mengenali req.db dan req.user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

// 1. Middleware untuk mengecek apakah user sudah login (Verifikasi JWT)
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ message: "Token tidak ditemukan atau format salah" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Gunakan req.db yang di-inject oleh tenant.middleware
    const db = req.db;

    // Cek apakah user masih ada di database tenant lokal dan statusnya aktif
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      include: { tenant: true }, // Ambil relasi tenant lokal
    });

    if (!user || !user.isActive) {
      res
        .status(401)
        .json({ message: "Akun tidak ditemukan atau tidak aktif" });
      return;
    }

    if (!user.tenant.isActive) {
      res.status(403).json({
        message: "Akses ditolak: Bisnis/Tenant Anda sedang dinonaktifkan",
      });
      return;
    }

    // Attach data user ke request untuk dipakai di controller selanjutnya
    req.user = {
      id: user.id,
      tenantId: user.tenantId, // ID Tenant Lokal
      branchId: user.branchId,
      roleId: user.roleId,
      email: user.email,
    };

    next();
  } catch (error) {
    // Tambahkan log untuk memudahkan debugging
    console.error("[Auth Middleware Error]:", error);
    res
      .status(401)
      .json({ message: "Sesi telah habis atau token tidak valid" });
  }
};

// 2. Middleware Dynamic RBAC untuk mengecek Permission (Terkoneksi ke Control Plane)
export const requirePermission = (requiredPermissionCode: string) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Ekstrak slug untuk berkomunikasi dengan Control Plane
      const slug = extractTenantSlug(req);
      if (!slug) throw new Error("Invalid tenant slug");

      const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
      if (!controlPlaneUrl) throw new Error("CONTROL_PLANE_URL is not defined");

      const token = generateInternalToken(slug);

      // Cek ke Control Plane apakah Role ID user memiliki Permission Code yang diminta
      const endpoint = `${controlPlaneUrl}/api/internal/tenant-permissions?slug=${encodeURIComponent(slug)}&roleId=${encodeURIComponent(req.user.roleId)}`;

      const response = await fetch(endpoint, {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      });

      const jsonResponse = await response.json().catch(() => ({}));

      if (!response.ok) {
        res.status(500).json({
          message: "Gagal memverifikasi hak akses ke Control Plane",
          error: jsonResponse,
        });
        return;
      }

      // Format response Control Plane menjadi flat array string (misal: ["BRANCH_CREATE", "BRANCH_READ"])
      let userPermissions: string[] = [];
      if (jsonResponse.success && Array.isArray(jsonResponse.data)) {
        userPermissions = jsonResponse.data.flatMap((mod: any) =>
          mod.permissions.map((p: any) => p.code),
        );
      }

      // Validasi apakah array permission mengandung code yang di-require
      const hasPermission = userPermissions.includes(requiredPermissionCode);

      if (!hasPermission) {
        res.status(403).json({
          message: `Akses ditolak. Anda tidak memiliki izin: ${requiredPermissionCode}`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error("[Permission Middleware Error]:", error);
      res.status(500).json({
        message: "Terjadi kesalahan saat memverifikasi hak akses",
        error,
      });
    }
  };
};
