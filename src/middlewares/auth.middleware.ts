// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Request agar mengenali req.db dan req.user (Sama seperti di Controller)
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

    // PERBAIKAN: Gunakan req.db yang di-inject oleh tenant.middleware
    const db = req.db;

    // Cek apakah user masih ada di database tenant dan statusnya aktif
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      include: { tenant: true },
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
      tenantId: user.tenantId,
      branchId: user.branchId,
      roleId: user.roleId,
      email: user.email,
    };

    next();
  } catch (error) {
    // Tambahkan log untuk memudahkan Anda sebagai DevOps melakukan debugging jika terjadi error lain
    console.error("[Auth Middleware Error]:", error);
    res
      .status(401)
      .json({ message: "Sesi telah habis atau token tidak valid" });
  }
};

// 2. Middleware Dynamic RBAC untuk mengecek Permission
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

      // PERBAIKAN: Gunakan req.db di sini juga
      const db = req.db;

      // Cek ke database apakah Role ID user memiliki Permission Code yang diminta
      const hasPermission = await db.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            code: requiredPermissionCode,
          },
        },
      });

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
