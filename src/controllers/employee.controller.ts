// src/controllers/employee.controller.ts
import { Request, Response } from "express";
import argon2 from "argon2";
import { generateInternalToken } from "../lib/internal-auth";
import { extractTenantSlug } from "../middlewares/tenant.middleware";

// Interface untuk mengatasi error TS 'req.user'
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// [GET] Ambil Semua Karyawan
export const getEmployees = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const slug = extractTenantSlug(req);

    if (!slug) throw new Error("Invalid tenant slug");

    // 1. Ambil data karyawan dari DB lokal (Tanpa include 'role' karena tabel Role sudah dipindah)
    const employees = await db.user.findMany({
      where: { tenantId, deletedAt: null }, // Abaikan user yang di-soft-delete
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
        roleId: true, // Ambil roleId untuk di-mapping nanti
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch data Roles dari Control Plane
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
    const roles = Array.isArray(roleJson.data) ? roleJson.data : [];

    // 3. Mapping roleId lokal ke nama Role dari Control Plane
    const formattedEmployees = employees.map((emp) => {
      const roleObj = roles.find((r: any) => r.id === emp.roleId);
      // Buang roleId dari response dan ganti dengan object role agar formatnya sama persis seperti sebelumnya
      const { roleId, ...rest } = emp;
      return {
        ...rest,
        role: roleObj
          ? { id: roleObj.id, name: roleObj.name }
          : { id: emp.roleId, name: "Unknown Role" },
      };
    });

    res.status(200).json({
      success: true,
      data: formattedEmployees,
      message: "Daftar karyawan berhasil diambil",
    });
  } catch (error) {
    console.error("[getEmployees Error]:", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil Detail 1 Karyawan
export const getEmployeeById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;
    const slug = extractTenantSlug(req);

    if (!slug) throw new Error("Invalid tenant slug");

    const employee = await db.user.findFirst({
      where: { id: String(employeeId), tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
        roleId: true,
        branch: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    // Fetch data Role dari Control Plane
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
    const roles = Array.isArray(roleJson.data) ? roleJson.data : [];
    const roleObj = roles.find((r: any) => r.id === employee.roleId);

    const { roleId, ...rest } = employee;
    const formattedEmployee = {
      ...rest,
      role: roleObj
        ? { id: roleObj.id, name: roleObj.name }
        : { id: employee.roleId, name: "Unknown Role" },
    };

    res.status(200).json({
      success: true,
      data: formattedEmployee,
      message: "Detail karyawan berhasil diambil",
    });
  } catch (error) {
    console.error("[getEmployeeById Error]:", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Tambah Karyawan Baru
export const createEmployee = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const { email, password, ...rest } = req.body;

    // Cek apakah email sudah terdaftar di sistem
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Email sudah digunakan" });
      return;
    }

    const passwordHash = await argon2.hash(password);

    const newUser = await db.user.create({
      data: {
        tenantId, // Wajib sesuai schema terbaru
        email,
        passwordHash,
        ...rest,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        roleId: true,
      }, // Jangan kembalikan passwordHash
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: "Karyawan berhasil didaftarkan",
    });
  } catch (error) {
    console.error("[createEmployee Error]:", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update Data Karyawan
export const updateEmployee = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;
    const { email, password, ...rest } = req.body;

    const existingEmployee = await db.user.findFirst({
      where: { id: String(employeeId), tenantId, deletedAt: null },
    });

    if (!existingEmployee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    // Jika ingin mengubah email, pastikan email baru belum dipakai orang lain
    if (email && email !== existingEmployee.email) {
      const emailCheck = await db.user.findUnique({ where: { email } });
      if (emailCheck) {
        res.status(400).json({
          success: false,
          message: "Email sudah digunakan oleh akun lain",
        });
        return;
      }
    }

    const dataToUpdate: any = { ...rest };
    if (email) dataToUpdate.email = email;
    if (password) dataToUpdate.passwordHash = await argon2.hash(password);

    const updatedEmployee = await db.user.update({
      where: { id: String(employeeId) },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
        roleId: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedEmployee,
      message: "Data karyawan berhasil diperbarui",
    });
  } catch (error) {
    console.error("[updateEmployee Error]:", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [DELETE] Hapus Karyawan (Soft Delete)
export const deleteEmployee = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;

    // Mencegah user menghapus akunnya sendiri secara tidak sengaja
    if (req.user!.id === employeeId) {
      res.status(400).json({
        success: false,
        message: "Anda tidak dapat menghapus akun Anda sendiri",
      });
      return;
    }

    const existingEmployee = await db.user.findFirst({
      where: { id: String(employeeId), tenantId, deletedAt: null },
    });

    if (!existingEmployee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    // Gunakan Soft Delete agar riwayat transaksi/cashflow karyawan ini tidak error/hilang
    await db.user.update({
      where: { id: String(employeeId) },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Karyawan berhasil dihapus (dinonaktifkan)",
    });
  } catch (error) {
    console.error("[deleteEmployee Error]:", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
