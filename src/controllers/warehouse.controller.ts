// src/controllers/warehouse.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { DistributionStatus } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// ==========================================
// A. CRUD GUDANG (WAREHOUSE)
// ==========================================

export const getWarehouses = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId },
      include: {
        _count: { select: { stocks: true } },
      },
    });
    res.status(200).json({ success: true, data: warehouses });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const getWarehouseById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const warehouseId = req.params.id;

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      include: {
        stocks: {
          include: { material: { select: { name: true, unit: true } } },
        },
      },
    });

    if (!warehouse) {
      res
        .status(404)
        .json({ success: false, message: "Gudang tidak ditemukan" });
      return;
    }

    res.status(200).json({ success: true, data: warehouse });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const createWarehouse = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const newWarehouse = await prisma.warehouse.create({
      data: { tenantId, ...req.body },
    });
    res
      .status(201)
      .json({
        success: true,
        data: newWarehouse,
        message: "Gudang berhasil ditambahkan",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const updateWarehouse = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const warehouseId = req.params.id;

    const existing = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });

    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Gudang tidak ditemukan" });
      return;
    }

    const updated = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: req.body,
    });

    res
      .status(200)
      .json({ success: true, data: updated, message: "Gudang diperbarui" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const deleteWarehouse = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const warehouseId = req.params.id;

    const existing = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });

    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Gudang tidak ditemukan" });
      return;
    }

    await prisma.warehouse.delete({ where: { id: warehouseId } });
    res.status(200).json({ success: true, message: "Gudang dihapus" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Gudang tidak dapat dihapus karena masih menampung data",
        error,
      });
  }
};

// ==========================================
// B. MANAGEMENT STOK & DISTRIBUSI
// ==========================================

// Tambah stok ke gudang (Misal: Belanja dari Supplier)
export const addWarehouseStock = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const warehouseId = req.params.id;
    const { materialId, quantity } = req.body;

    // Pastikan gudang tersebut ada dan milik tenant
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });

    if (!warehouse) {
      res
        .status(404)
        .json({ success: false, message: "Gudang tidak ditemukan" });
      return;
    }

    // Gunakan upsert: Jika stok belum ada maka buat record baru, jika ada maka tambah quantity-nya
    const stock = await prisma.warehouseStock.upsert({
      where: { warehouseId_materialId: { warehouseId, materialId } },
      update: { quantity: { increment: quantity } },
      create: { warehouseId, materialId, quantity },
      include: { material: { select: { name: true, unit: true } } },
    });

    res
      .status(200)
      .json({
        success: true,
        data: stock,
        message: "Stok gudang berhasil ditambahkan",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// Ambil Riwayat Distribusi
export const getDistributions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;

    const distributions = await prisma.materialDistribution.findMany({
      where: {
        sourceWarehouse: { tenantId }, // Hanya ambil distribusi dari gudang milik tenant ini
      },
      include: {
        sourceWarehouse: { select: { name: true } },
        destBranch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        items: {
          include: { material: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: distributions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// Buat Permintaan Distribusi (Gudang -> Cabang)
export const createDistribution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { sourceWarehouseId, destBranchId, notes, items } = req.body;
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId;

    // 1. Validasi kepemilikan Gudang dan Cabang
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: sourceWarehouseId, tenantId },
    });
    const branch = await prisma.branch.findFirst({
      where: { id: destBranchId, tenantId },
    });

    if (!warehouse || !branch) {
      res
        .status(404)
        .json({
          success: false,
          message: "Gudang atau Cabang tidak ditemukan/tidak valid",
        });
      return;
    }

    // 2. Transaksi Distribusi
    const distribution = await prisma.$transaction(async (tx) => {
      // Periksa kecukupan stok sebelum mengurangi
      for (const item of items) {
        const stock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_materialId: {
              warehouseId: sourceWarehouseId,
              materialId: item.materialId,
            },
          },
        });

        if (!stock || Number(stock.quantity) < item.quantity) {
          throw new Error(
            `Stok untuk material ID ${item.materialId} tidak mencukupi`,
          );
        }
      }

      const dist = await tx.materialDistribution.create({
        data: {
          sourceWarehouseId,
          destBranchId,
          createdById: userId,
          status: DistributionStatus.IN_TRANSIT,
          dispatchedAt: new Date(),
          notes,
          items: {
            create: items.map((item: any) => ({
              materialId: item.materialId,
              quantity: item.quantity,
            })),
          },
        },
      });

      // Kurangi stok di Warehouse
      for (const item of items) {
        await tx.warehouseStock.update({
          where: {
            warehouseId_materialId: {
              warehouseId: sourceWarehouseId,
              materialId: item.materialId,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return dist;
    });

    res
      .status(201)
      .json({
        success: true,
        data: distribution,
        message: "Distribusi dikirim ke cabang",
      });
  } catch (error: any) {
    res
      .status(400)
      .json({
        success: false,
        message: error.message || "Gagal memproses distribusi",
      });
  }
};

// Terima Distribusi di Cabang
export const receiveDistribution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const distributionId = req.params.id;
    const tenantId = req.user!.tenantId;

    const distribution = await prisma.materialDistribution.findUnique({
      where: { id: distributionId },
      include: { items: true, destBranch: true },
    });

    if (!distribution || distribution.destBranch.tenantId !== tenantId) {
      res
        .status(404)
        .json({ success: false, message: "Distribusi tidak ditemukan" });
      return;
    }

    if (distribution.status !== DistributionStatus.IN_TRANSIT) {
      res
        .status(400)
        .json({
          success: false,
          message: "Distribusi sudah diterima atau dibatalkan",
        });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.materialDistribution.update({
        where: { id: distributionId },
        data: { status: DistributionStatus.RECEIVED, receivedAt: new Date() },
      });

      for (const item of distribution.items) {
        await tx.branchMaterialStock.upsert({
          where: {
            branchId_materialId: {
              branchId: distribution.destBranchId,
              materialId: item.materialId,
            },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            branchId: distribution.destBranchId,
            materialId: item.materialId,
            quantity: item.quantity,
          },
        });
      }
    });

    res
      .status(200)
      .json({
        success: true,
        message: "Barang berhasil diterima dan stok cabang bertambah",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal menerima barang", error });
  }
};
