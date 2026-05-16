// src/controllers/branch.controller.ts
import { Request, Response } from "express";

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

// [GET] Ambil Semua Cabang
export const getBranches = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const branches = await db.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { users: true, products: true, orders: true } },
        receiptSetting: { select: { documentFormat: true, storeName: true } },
        paymentIntegration: { select: { channelType: true } },
      },
    });

    res.status(200).json({
      success: true,
      data: branches,
      message: "Daftar cabang berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil Detail 1 Cabang
export const getBranchById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const branchId = req.params.id;

    const branch = await db.branch.findFirst({
      where: { id: String(branchId), tenantId },
      include: {
        receiptSetting: true,
        paymentIntegration: true,
      },
    });

    if (!branch) {
      res
        .status(404)
        .json({ success: false, message: "Cabang tidak ditemukan" });
      return;
    }

    res.status(200).json({
      success: true,
      data: branch,
      message: "Detail cabang berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Tambah Cabang Baru
export const createBranch = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    // Gunakan transaksi untuk membuat Cabang, Seting Struk, & Payment secara bersamaan
    const newBranch = await db.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          tenantId,
          ...req.body,
        },
      });

      // Buat default Receipt Setting
      await tx.receiptSetting.create({
        data: {
          branchId: branch.id,
          storeName: branch.name,
        },
      });

      // Buat default Payment Integration (Basic)
      await tx.paymentIntegration.create({
        data: {
          branchId: branch.id,
        },
      });

      return branch;
    });

    res.status(201).json({
      success: true,
      data: newBranch,
      message: "Cabang berhasil dibuat",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update Data Cabang
export const updateBranch = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const branchId = req.params.id;

    // Pastikan cabang ada dan milik tenant yang sedang login
    const existingBranch = await db.branch.findFirst({
      where: { id: String(branchId), tenantId },
    });

    if (!existingBranch) {
      res
        .status(404)
        .json({ success: false, message: "Cabang tidak ditemukan" });
      return;
    }

    const updatedBranch = await db.branch.update({
      where: { id: String(branchId) },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      data: updatedBranch,
      message: "Data cabang berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [DELETE] Hapus Cabang
export const deleteBranch = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const branchId = req.params.id;

    const existingBranch = await db.branch.findFirst({
      where: { id: String(branchId), tenantId },
    });

    if (!existingBranch) {
      res
        .status(404)
        .json({ success: false, message: "Cabang tidak ditemukan" });
      return;
    }

    // Menghapus cabang akan memicu onDelete: Cascade untuk ReceiptSetting dan PaymentIntegration
    await db.branch.delete({
      where: { id: String(branchId) },
    });

    res.status(200).json({
      success: true,
      message:
        "Cabang beserta pengaturan struk dan pembayarannya berhasil dihapus",
    });
  } catch (error) {
    // Tangani error jika cabang masih memiliki transaksi atau karyawan
    if (
      error instanceof Error &&
      error.message.includes("Foreign key constraint failed")
    ) {
      res.status(400).json({
        success: false,
        message:
          "Cabang tidak dapat dihapus karena masih memiliki data karyawan, produk, atau transaksi yang terikat.",
      });
      return;
    }
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
