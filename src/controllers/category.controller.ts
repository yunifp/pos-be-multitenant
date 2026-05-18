// src/controllers/category.controller.ts
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

// [GET] Ambil semua kategori
export const getCategories = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const categories = await db.category.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
    });

    res.status(200).json({
      success: true,
      data: categories,
      message: "Daftar kategori berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil detail 1 kategori
export const getCategoryById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    // Jika berupa array, ambil index [0]. Jika bukan, langsung jadikan string.
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const categoryId = parseInt(idString);

    if (isNaN(categoryId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Kategori tidak valid" });
      return;
    }

    // Gunakan findFirst untuk memastikan kategori ini milik tenant yang sedang login
    const category = await db.category.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
      message: "Detail kategori berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Tambah kategori baru
export const createCategory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const category = await db.category.create({
      data: { tenantId, ...req.body },
    });

    res.status(201).json({
      success: true,
      data: category,
      message: "Kategori berhasil ditambahkan",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update kategori
export const updateCategory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    // Jika berupa array, ambil index [0]. Jika bukan, langsung jadikan string.
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const categoryId = parseInt(idString);

    if (isNaN(categoryId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Kategori tidak valid" });
      return;
    }

    // Cek apakah kategori ada dan milik tenant ini
    const existingCategory = await db.category.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!existingCategory) {
      res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
      return;
    }

    // Lakukan update
    const updatedCategory = await db.category.update({
      where: { id: categoryId },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      data: updatedCategory,
      message: "Kategori berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [DELETE] Hapus kategori
export const deleteCategory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    // Jika berupa array, ambil index [0]. Jika bukan, langsung jadikan string.
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const categoryId = parseInt(idString);

    if (isNaN(categoryId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Kategori tidak valid" });
      return;
    }

    // Cek apakah kategori ada dan milik tenant ini
    const existingCategory = await db.category.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!existingCategory) {
      res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
      return;
    }

    // Lakukan penghapusan
    await db.category.delete({
      where: { id: categoryId },
    });

    res
      .status(200)
      .json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (error) {
    // Tangani error khusus Prisma jika kategori masih dipakai di produk (Foreign Key Constraint)
    if (
      error instanceof Error &&
      error.message.includes("Foreign key constraint failed")
    ) {
      res.status(400).json({
        success: false,
        message:
          "Kategori tidak dapat dihapus karena masih digunakan pada produk",
      });
      return;
    }
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
