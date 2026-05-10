// src/controllers/employee.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import bcrypt from "bcrypt";

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
    const tenantId = req.user!.tenantId;
    const employees = await prisma.user.findMany({
      where: { tenantId, deletedAt: null }, // Abaikan user yang di-soft-delete
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: employees,
      message: "Daftar karyawan berhasil diambil",
    });
  } catch (error) {
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
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;

    const employee = await prisma.user.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    res.status(200).json({
      success: true,
      data: employee,
      message: "Detail karyawan berhasil diambil",
    });
  } catch (error) {
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
    const tenantId = req.user!.tenantId;
    const { email, password, ...rest } = req.body;

    // Cek apakah email sudah terdaftar di sistem
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Email sudah digunakan" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        ...rest,
      },
      select: { id: true, email: true, fullName: true, jobPosition: true }, // Jangan kembalikan passwordHash
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: "Karyawan berhasil didaftarkan",
    });
  } catch (error) {
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
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;
    const { email, password, ...rest } = req.body;

    const existingEmployee = await prisma.user.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });

    if (!existingEmployee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    // Jika ingin mengubah email, pastikan email baru belum dipakai orang lain
    if (email && email !== existingEmployee.email) {
      const emailCheck = await prisma.user.findUnique({ where: { email } });
      if (emailCheck) {
        res
          .status(400)
          .json({
            success: false,
            message: "Email sudah digunakan oleh akun lain",
          });
        return;
      }
    }

    const dataToUpdate: any = { ...rest };
    if (email) dataToUpdate.email = email;
    if (password) dataToUpdate.passwordHash = await bcrypt.hash(password, 10);

    const updatedEmployee = await prisma.user.update({
      where: { id: employeeId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        jobPosition: true,
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedEmployee,
      message: "Data karyawan berhasil diperbarui",
    });
  } catch (error) {
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
    const tenantId = req.user!.tenantId;
    const employeeId = req.params.id;

    // Mencegah user menghapus akunnya sendiri secara tidak sengaja
    if (req.user!.id === employeeId) {
      res
        .status(400)
        .json({
          success: false,
          message: "Anda tidak dapat menghapus akun Anda sendiri",
        });
      return;
    }

    const existingEmployee = await prisma.user.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });

    if (!existingEmployee) {
      res
        .status(404)
        .json({ success: false, message: "Karyawan tidak ditemukan" });
      return;
    }

    // Gunakan Soft Delete agar riwayat transaksi/cashflow karyawan ini tidak error/hilang
    await prisma.user.update({
      where: { id: employeeId },
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
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
