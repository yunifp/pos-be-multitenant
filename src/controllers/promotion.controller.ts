import { Request, Response } from 'express';
import { PrismaClient, PromotionType, Role } from '@prisma/client';

const prisma = new PrismaClient();

// --- HELPER VALIDATION ---
const validatePromotionLogic = async (branchId: string, type: PromotionType, targetProductIds: any[], currentPromoId?: string) => {
    const now = new Date();

    // 1. Validasi PRODUCT_DISCOUNT: Satu produk hanya boleh punya 1 diskon aktif
    if (type === 'PRODUCT_DISCOUNT') {
        const variantIds = targetProductIds.map(t => t.variantId);
        
        const existingConflict = await prisma.promotionTarget.findFirst({
            where: {
                variantId: { in: variantIds },
                promotion: {
                    id: currentPromoId ? { not: currentPromoId } : undefined,
                    branchId: branchId,
                    type: 'PRODUCT_DISCOUNT',
                    endDate: { gte: now }, // Promo belum berakhir
                    deletedAt: null,
                    isActive: true
                }
            },
            include: { promotion: true, variant: true }
        });

        if (existingConflict) {
            throw new Error(`Produk ${existingConflict.variant.name} sudah memiliki promo diskon aktif (${existingConflict.promotion.name})`);
        }
    }

    // 2. Validasi BUNDLE: Minimal 2 produk & tidak boleh kombinasi produk yang sama persis
    if (type === 'BUNDLE') {
        if (!targetProductIds || targetProductIds.length < 2) {
            throw new Error("Promo Bundle wajib memilih minimal 2 produk.");
        }

        const incomingVariantIds = targetProductIds.map(t => t.variantId).sort();

        // Cari semua promo bundle aktif di cabang tersebut
        const existingBundles = await prisma.promotion.findMany({
            where: {
                id: currentPromoId ? { not: currentPromoId } : undefined,
                branchId: branchId,
                type: 'BUNDLE',
                endDate: { gte: now },
                deletedAt: null,
                isActive: true
            },
            include: { targets: true }
        });

        for (const bundle of existingBundles) {
            const existingVariantIds = bundle.targets.map(t => t.variantId).sort();
            
            // Cek apakah kombinasi produk sama persis
            if (JSON.stringify(incomingVariantIds) === JSON.stringify(existingVariantIds)) {
                throw new Error(`Kombinasi produk ini sudah terdaftar dalam promo bundle lain (${bundle.name})`);
            }
        }
    }
};

// --- CREATE PROMOTION ---
export const createPromotion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { 
      name, code, type, 
      discountPct, discountAmt, 
      minPurchase, maxDiscount, 
      startDate, endDate, 
      targetBranchIds,
      targetProductIds 
    } = req.body;

    let branchesToInsert: string[] = user.role === Role.OWNER ? targetBranchIds : [user.branchId];
    if (!branchesToInsert || branchesToInsert.length === 0) return res.status(400).json({ message: "Pilih minimal satu cabang" });

    // Jalankan validasi untuk setiap cabang target
    try {
        for (const branchId of branchesToInsert) {
            await validatePromotionLogic(branchId, type as PromotionType, targetProductIds || []);
        }
    } catch (valError: any) {
        return res.status(400).json({ message: valError.message });
    }

    const promises = branchesToInsert.map(async (branchId) => {
      const uniqueCode = branchesToInsert.length > 1 ? `${code}-${branchId.substring(0, 3)}` : code;

      let targetsData = {};
      if (type !== 'TRANSACTION' && targetProductIds && targetProductIds.length > 0) {
        targetsData = {
          create: targetProductIds.map((t: any) => ({
            variantId: t.variantId,
            quantity: t.quantity || 1
          }))
        };
      }

      return prisma.promotion.create({
        data: {
          branchId,
          name,
          code: uniqueCode,
          type: type as PromotionType,
          discountPct: discountPct ? parseInt(discountPct) : null,
          discountAmt: discountAmt ? parseFloat(discountAmt) : null,
          minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
          maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          targets: targetsData
        }
      });
    });

    await Promise.all(promises);
    return res.status(201).json({ message: "Promosi berhasil dibuat" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal membuat promosi" });
  }
};

// --- UPDATE PROMOTION ---
export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, code, type, 
      discountPct, discountAmt, 
      minPurchase, maxDiscount, 
      startDate, endDate,
      targetProductIds 
    } = req.body;

    const existingPromo = await prisma.promotion.findUnique({ where: { id } });
    if (!existingPromo) return res.status(404).json({ message: "Promo tidak ditemukan" });

    // Validasi Logika sebelum Update
    try {
        await validatePromotionLogic(existingPromo.branchId!, type as PromotionType, targetProductIds || [], id);
    } catch (valError: any) {
        return res.status(400).json({ message: valError.message });
    }

    await prisma.$transaction(async (tx) => {
        await tx.promotion.update({
            where: { id },
            data: {
                name,
                type: type as PromotionType,
                discountPct: discountPct ? parseInt(discountPct) : null,
                discountAmt: discountAmt ? parseFloat(discountAmt) : null,
                minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
                maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            }
        });

        if (type !== 'TRANSACTION') {
            await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
            if (targetProductIds && targetProductIds.length > 0) {
                await tx.promotionTarget.createMany({
                    data: targetProductIds.map((t: any) => ({
                        promotionId: id,
                        variantId: t.variantId,
                        quantity: t.quantity || 1
                    }))
                });
            }
        }
    });

    return res.json({ message: "Promosi berhasil diperbarui" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal update promosi" });
  }
};

// --- GET PROMOTIONS ---
export const getPromotions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { branchId } = req.query;

    let filterBranchId = user.branchId;
    if (user.role === Role.OWNER) {
        if (branchId) filterBranchId = branchId as string;
        else return res.json([]);
    }

    const promotions = await prisma.promotion.findMany({
      where: {
        branchId: filterBranchId,
        deletedAt: null
      },
      include: {
        targets: { // Include detail produk yg didiskon
            include: { variant: true }
        } 
      },
      orderBy: { startDate: 'desc' }
    });

    return res.json(promotions);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data promosi" });
  }
};

// GET PROMOTION BY BRANCH ID & TYPE
export const getPromotionsByBranchAndType = async (req: Request, res: Response) => {
  try {
    const { branchId, type } = req.query;
    if (!branchId || !type) return res.status(400).json({ message: "branchId dan type diperlukan" });
    const promotions = await prisma.promotion.findMany({
      where: {
        branchId: branchId as string,
        type: type as PromotionType,
        deletedAt: null
      },
      include: {
        targets: {
            include: { variant: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });
    return res.json(promotions);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data promosi" });
  }
};
// --- DELETE PROMOTION ---
export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.promotion.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });
    return res.json({ message: "Promosi dihapus" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal hapus promosi" });
  }
};