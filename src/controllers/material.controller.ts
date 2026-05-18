// src/controllers/material.controller.ts
import { Request, Response } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// [GET] Ambil semua bahan baku
export const getMaterials = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const materials = await db.material.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      data: materials,
      message: "Daftar bahan baku berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil detail 1 bahan baku
export const getMaterialById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const materialId = req.params.id; // Tipe UUID (String), tidak perlu parseInt

    const material = await db.material.findFirst({
      where: { id: String(materialId), tenantId },
    });

    if (!material) {
      res
        .status(404)
        .json({ success: false, message: "Bahan baku tidak ditemukan" });
      return;
    }

    res.status(200).json({
      success: true,
      data: material,
      message: "Detail bahan baku berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Tambah bahan baku baru
export const createMaterial = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    const material = await db.material.create({
      data: { tenantId, ...req.body },
    });

    res.status(201).json({
      success: true,
      data: material,
      message: "Bahan baku berhasil ditambahkan",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update bahan baku
export const updateMaterial = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const materialId = req.params.id;

    // Pastikan bahan baku milik tenant yang sedang login
    const existingMaterial = await db.material.findFirst({
      where: { id: String(materialId), tenantId },
    });

    if (!existingMaterial) {
      res
        .status(404)
        .json({ success: false, message: "Bahan baku tidak ditemukan" });
      return;
    }

    const updatedMaterial = await db.material.update({
      where: { id: String(materialId) },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      data: updatedMaterial,
      message: "Bahan baku berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [DELETE] Hapus bahan baku
export const deleteMaterial = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const materialId = req.params.id;

    const existingMaterial = await db.material.findFirst({
      where: { id: String(materialId), tenantId },
    });

    if (!existingMaterial) {
      res
        .status(404)
        .json({ success: false, message: "Bahan baku tidak ditemukan" });
      return;
    }

    await db.material.delete({
      where: { id: String(materialId) },
    });

    res
      .status(200)
      .json({ success: true, message: "Bahan baku berhasil dihapus" });
  } catch (error) {
    // Menangkap error jika bahan baku sedang dipakai di Gudang, Cabang, atau Resep (Foreign Key)
    if (
      error instanceof Error &&
      error.message.includes("Foreign key constraint failed")
    ) {
      res.status(400).json({
        success: false,
        message:
          "Bahan baku ini tidak dapat dihapus karena masih digunakan dalam stok gudang, cabang, atau resep produk.",
      });
      return;
    }
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
