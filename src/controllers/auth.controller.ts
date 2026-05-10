// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { JobPosition } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";
const JWT_EXPIRES_IN = "1d"; // Token berlaku 1 hari

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Cari user berdasarkan email
    const user = await prisma.user.findUnique({
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

    // 2. Validasi Password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
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
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
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

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({
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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { tenantName, fullName, email, password, phone } = req.body;

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: "Email sudah terdaftar" });
      return;
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Gunakan transaksi untuk memastikan Tenant, Role, dan User dibuat bersamaan
    const result = await prisma.$transaction(async (tx) => {
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
