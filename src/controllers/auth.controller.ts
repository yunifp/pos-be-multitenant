// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { JobPosition } from "@prisma/client";

// Extend Request untuk mengakomodasi req.user (req.db sudah otomatis ada dari global override middleware)
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
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = req.db;
    const { email, password } = req.body;

    // 1. Cari user berdasarkan email di database tenant spesifik
    const user = await db.user.findUnique({
      where: { email },
      include: { tenant: true, role: true },
    });

    if (!user) {
      res.status(404).json({ message: "Email atau password salah" });
      return;
    }

    if (!user.isActive || !user.tenant.isActive) {
      res
        .status(403)
        .json({ message: "Akun atau Perusahaan Anda tidak aktif" });
      return;
    }

    // 2. Validasi Password menggunakan argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Email atau password salah" });
      return;
    }

    // 3. Generate Token
    const token = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        roleId: user.roleId,
      },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as any },
    );

    // 4. Return Data
    res.status(200).json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        jobPosition: user.jobPosition,
        role: user.role.name,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server", error });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = req.db;
    const userId = req.user?.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobPosition: true,
        branch: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, activeFeatures: true } },
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                permission: {
                  select: { code: true, module: true, action: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    // Format permissions agar lebih mudah dibaca oleh Frontend (array of strings)
    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    res.status(200).json({
      ...user,
      role: user.role.name,
      permissions, // ex: ["ORDER_CREATE", "INVENTORY_READ"]
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server", error });
  }
};

// Pendaftaran Klien/Bisnis Baru (SaaS Onboarding)
export const registerTenant = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const { tenantName, fullName, email, password, phone } = req.body;

    // Cek apakah email sudah terdaftar
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: "Email sudah terdaftar" });
      return;
    }

    // Hash Password menggunakan argon2
    const passwordHash = await argon2.hash(password);

    // Gunakan transaksi untuk memastikan Tenant, Role, dan User dibuat bersamaan
    const result = await db.$transaction(async (tx) => {
      // 1. Buat Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          email: email,
          phone: phone,
          activeFeatures: ["INVENTORY"], // Default feature
        },
      });

      // 2. Setup General Setting Default
      await tx.generalSetting.create({
        data: {
          tenantId: tenant.id,
          storeName: tenantName,
        },
      });

      // 3. Buat Role Owner untuk Tenant ini
      const roleOwner = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: "Owner",
          description: "Akses penuh pemilik bisnis",
        },
      });

      // (Opsional) Berikan semua permission yang ada ke Owner
      const allPermissions = await tx.permission.findMany();
      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((perm) => ({
            roleId: roleOwner.id,
            permissionId: perm.id,
          })),
        });
      }

      // 4. Buat User sebagai Owner
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          roleId: roleOwner.id,
          fullName: fullName,
          email: email,
          passwordHash: passwordHash,
          jobPosition: JobPosition.OWNER,
        },
      });

      return { tenant, user };
    });

    res.status(201).json({
      message: "Pendaftaran berhasil. Silakan login.",
      tenantId: result.tenant.id,
      userId: result.user.id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat pendaftaran", error });
  }
};
