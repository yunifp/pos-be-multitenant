// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { JobPosition } from "@prisma/client";
import { generateInternalToken } from "../lib/internal-auth";
import { extractTenantSlug } from "../middlewares/tenant.middleware";

// Extend Request untuk mengakomodasi req.user
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

    // 1. Ekstrak slug dari request
    const slug = extractTenantSlug(req);
    if (!slug) throw new Error("Invalid tenant slug");

    // 2. Cari user beserta data tenant lokalnya
    const user = await db.user.findUnique({
      where: { email },
      include: { tenant: true }, // Mengambil relasi tenant untuk mengecek status aktif
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

    // 3. Validasi Password menggunakan argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Email atau password salah" });
      return;
    }

    // 4. Ambil Data Role dan Permissions dari Control Plane API
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl) throw new Error("CONTROL_PLANE_URL is not defined");
    const token = generateInternalToken(slug);

    // Fetch Role (Untuk mendapatkan nama role)
    const roleRes = await fetch(
      `${controlPlaneUrl}/api/internal/tenant-roles?slug=${encodeURIComponent(slug)}`,
      {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      },
    );
    const roleJson = await roleRes.json().catch(() => ({}));
    const roleObj = Array.isArray(roleJson.data)
      ? roleJson.data.find((r: any) => r.id === user.roleId)
      : null;
    const roleName = roleObj ? roleObj.name : "UNKNOWN_ROLE";

    // Fetch Permissions
    const permRes = await fetch(
      `${controlPlaneUrl}/api/internal/tenant-permissions?slug=${encodeURIComponent(slug)}&roleId=${encodeURIComponent(user.roleId)}`,
      {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      },
    );
    const permJson = await permRes.json().catch(() => ({}));

    // Parsing struktur Array JSON bersarang berdasarkan module dari respons Control Plane
    let userPermissions: string[] = [];
    if (permJson.success && Array.isArray(permJson.data)) {
      userPermissions = permJson.data.flatMap((moduleGroup: any) =>
        moduleGroup.permissions.map((p: any) => p.code),
      );
    }

    // 5. Generate Token
    const jwtToken = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenantId, // Menggunakan UUID tenant asli dari local DB
        branchId: user.branchId,
        roleId: user.roleId,
      },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN as any },
    );

    // 6. Return Data
    res.status(200).json({
      message: "Login berhasil",
      token: jwtToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        jobPosition: user.jobPosition,
        role: roleName,
        permissions: userPermissions,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    console.error("[Login Error]:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server", error });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = req.db;
    const userId = req.user?.id;
    const slug = extractTenantSlug(req);

    if (!slug) throw new Error("Invalid tenant slug");

    // Cari user di local DB beserta Tenant (sesuai schema baru)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobPosition: true,
        branch: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, activeFeatures: true } },
        roleId: true,
        tenantId: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    // Ambil Data Role dan Permissions dari Control Plane API
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl) throw new Error("CONTROL_PLANE_URL is not defined");
    const token = generateInternalToken(slug);

    // Fetch Role (Untuk mendapatkan nama role)
    const roleRes = await fetch(
      `${controlPlaneUrl}/api/internal/tenant-roles?slug=${encodeURIComponent(slug)}`,
      {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      },
    );
    const roleJson = await roleRes.json().catch(() => ({}));
    const roleObj = Array.isArray(roleJson.data)
      ? roleJson.data.find((r: any) => r.id === user.roleId)
      : null;
    const roleName = roleObj ? roleObj.name : "UNKNOWN_ROLE";

    // Fetch Permissions
    const permRes = await fetch(
      `${controlPlaneUrl}/api/internal/tenant-permissions?slug=${encodeURIComponent(slug)}&roleId=${encodeURIComponent(user.roleId)}`,
      {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      },
    );
    const permJson = await permRes.json().catch(() => ({}));

    // Parsing dari format Control Plane
    let permissions: string[] = [];
    if (permJson.success && Array.isArray(permJson.data)) {
      permissions = permJson.data.flatMap((moduleGroup: any) =>
        moduleGroup.permissions.map((p: any) => p.code),
      );
    }

    // Return User Detail beserta Role & Permission yang sudah diformat
    res.status(200).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      jobPosition: user.jobPosition,
      branch: user.branch,
      tenant: user.tenant, // Melampirkan info tenant
      role: roleName,
      permissions,
      tenantId: user.tenantId,
    });
  } catch (error) {
    console.error("[GetMe Error]:", error);
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
    const slug = extractTenantSlug(req);

    if (!slug) throw new Error("Invalid tenant slug");

    // Cek apakah email sudah terdaftar
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: "Email sudah terdaftar" });
      return;
    }

    // Ambil Role OWNER dari Control Plane (Sebagai Role default pendaftar pertama)
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl) throw new Error("CONTROL_PLANE_URL is not defined");

    const token = generateInternalToken(slug);
    const roleRes = await fetch(
      `${controlPlaneUrl}/api/internal/tenant-roles?slug=${encodeURIComponent(slug)}`,
      {
        headers: { "x-internal-token": token },
        signal: AbortSignal.timeout(5000),
      },
    );
    const roleJson = await roleRes.json().catch(() => ({}));
    const ownerRole = Array.isArray(roleJson.data)
      ? roleJson.data.find((r: any) => r.name === "OWNER" || r.name === "Owner")
      : null;

    if (!ownerRole) {
      res
        .status(500)
        .json({ message: "Gagal menginisiasi Role Owner dari Control Plane." });
      return;
    }

    // Hash Password menggunakan argon2
    const passwordHash = await argon2.hash(password);

    // Gunakan transaksi untuk Setup Database Lokal sesuai schema terbaru
    const result = await db.$transaction(async (tx) => {
      // 1. Buat record Tenant lokal
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          email: email,
          phone: phone || null,
          activeFeatures: ["INVENTORY"], // Default feature
        },
      });

      // 2. Setup General Setting untuk tenant tersebut
      await tx.generalSetting.create({
        data: {
          tenantId: tenant.id,
          storeName: tenantName,
        },
      });

      // 3. Buat User sebagai Owner yang berelasi ke Tenant ID tersebut
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          roleId: ownerRole.id,
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
      tenantId: result.tenant.id, // Menampilkan UUID asli dari Database
      userId: result.user.id,
    });
  } catch (error) {
    console.error("[RegisterTenant Error]:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat pendaftaran", error });
  }
};
