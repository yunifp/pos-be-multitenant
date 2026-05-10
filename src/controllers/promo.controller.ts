// src/controllers/promo.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./member.controller";

export const getPromotions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;

    // Cari promo yang terhubung ke cabang-cabang milik tenant ini
    const promos = await prisma.promotion.findMany({
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

export const createPromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
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

    const existingPromo = await prisma.promotion.findUnique({
      where: { code },
    });
    if (existingPromo) {
      res
        .status(400)
        .json({ success: false, message: "Kode Promo sudah digunakan" });
      return;
    }

    const promo = await prisma.promotion.create({
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
