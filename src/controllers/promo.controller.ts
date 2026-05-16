// src/controllers/promo.controller.ts
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

// [GET] Ambil Semua Promo
export const getPromotions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    // Cari promo yang terhubung ke cabang-cabang milik tenant ini
    const promos = await db.promotion.findMany({
      where: { branches: { some: { tenantId } }, deletedAt: null },
      include: { targets: true, branches: { select: { name: true } } },
    });

    res.status(200).json({ success: true, data: promos });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

// [POST] Buat Promo Baru
export const createPromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const {
      name,
      code,
      type,
      discountPct,
      discountAmt,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      isGlobal,
      branchIds,
      targetVariantIds,
    } = req.body;

    const existingPromo = await db.promotion.findUnique({
      where: { code },
    });
    if (existingPromo) {
      res
        .status(400)
        .json({ success: false, message: "Kode Promo sudah digunakan" });
      return;
    }

    const promo = await db.promotion.create({
      data: {
        name,
        code,
        type,
        discountPct,
        discountAmt,
        minPurchase,
        maxDiscount,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isGlobal,
        // Menyambungkan Promo ke Cabang tertentu
        branches:
          branchIds && branchIds.length > 0
            ? { connect: branchIds.map((id: string) => ({ id })) }
            : undefined,
        // Menyambungkan Promo ke Varian Produk tertentu (jika tipe PRODUCT_DISCOUNT)
        targets:
          targetVariantIds && targetVariantIds.length > 0
            ? {
                create: targetVariantIds.map((variantId: number) => ({
                  variantId,
                })),
              }
            : undefined,
      },
    });

    res
      .status(201)
      .json({ success: true, data: promo, message: "Promo berhasil dibuat" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal membuat promo", error });
  }
};

// [PUT] Update Promo
export const updatePromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const promoId = req.params.id;
    const tenantId = req.user!.tenantId;
    const {
      name,
      code,
      type,
      discountPct,
      discountAmt,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      isActive,
      isGlobal,
      branchIds,
      targetVariantIds,
    } = req.body;

    // Pastikan promo ada dan terhubung dengan tenant ini
    const existingPromo = await db.promotion.findFirst({
      where: { id: promoId, branches: { some: { tenantId } }, deletedAt: null },
    });

    if (!existingPromo) {
      res
        .status(404)
        .json({ success: false, message: "Promo tidak ditemukan" });
      return;
    }

    // Jika ingin mengubah kode promo, pastikan tidak duplikat dengan yang lain
    if (code && code !== existingPromo.code) {
      const codeCheck = await db.promotion.findUnique({ where: { code } });
      if (codeCheck) {
        res
          .status(400)
          .json({ success: false, message: "Kode Promo sudah digunakan" });
        return;
      }
    }

    // Gunakan Transaksi untuk mengelola update bersarang (Nested Updates)
    const updatedPromo = await db.$transaction(async (tx) => {
      // Jika ada perubahan pada target varian produk, hapus yang lama
      if (targetVariantIds) {
        await tx.promotionTarget.deleteMany({
          where: { promotionId: promoId },
        });
      }

      return await tx.promotion.update({
        where: { id: promoId },
        data: {
          name,
          code,
          type,
          discountPct,
          discountAmt,
          minPurchase,
          maxDiscount,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          isActive,
          isGlobal,
          // Set ulang relasi cabang
          ...(branchIds && {
            branches: { set: branchIds.map((id: string) => ({ id })) },
          }),
          // Buat ulang relasi target varian (jika ada)
          ...(targetVariantIds &&
            targetVariantIds.length > 0 && {
              targets: {
                create: targetVariantIds.map((variantId: number) => ({
                  variantId,
                })),
              },
            }),
        },
        include: { targets: true, branches: { select: { name: true } } },
      });
    });

    res.status(200).json({
      success: true,
      data: updatedPromo,
      message: "Promo berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal memperbarui promo", error });
  }
};

// [DELETE] Hapus Promo (Soft Delete)
export const deletePromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const promoId = req.params.id;
    const tenantId = req.user!.tenantId;

    const existingPromo = await db.promotion.findFirst({
      where: { id: promoId, branches: { some: { tenantId } }, deletedAt: null },
    });

    if (!existingPromo) {
      res
        .status(404)
        .json({ success: false, message: "Promo tidak ditemukan" });
      return;
    }

    // Menggunakan Soft Delete untuk menjaga integritas riwayat order masa lalu
    await db.promotion.update({
      where: { id: promoId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    res
      .status(200)
      .json({
        success: true,
        message: "Promo berhasil dihapus (dinonaktifkan)",
      });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Terjadi kesalahan saat menghapus promo",
        error,
      });
  }
};
