// src/controllers/product.controller.ts
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

// [GET] Ambil Semua Produk
export const getProducts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const products = await db.product.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
      include: {
        category: { select: { name: true } },
        variants: {
          include: {
            recipes: {
              include: { material: { select: { name: true, unit: true } } },
            },
          },
        },
      },
    });
    res.status(200).json({
      success: true,
      data: products,
      message: "Daftar produk berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil Detail 1 Produk
export const getProductById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Produk tidak valid" });
      return;
    }

    const product = await db.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        category: { select: { name: true } },
        variants: {
          include: {
            recipes: {
              include: {
                material: {
                  select: { name: true, unit: true, costPerUnit: true },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      res
        .status(404)
        .json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    res.status(200).json({
      success: true,
      data: product,
      message: "Detail produk berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Tambah Produk Baru
export const createProduct = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const { categoryId, branchId, name, variants } = req.body;

    const newProduct = await db.product.create({
      data: {
        tenantId,
        categoryId,
        branchId,
        name,
        variants: {
          create: variants.map((variant: any) => ({
            name: variant.name,
            price: variant.price,
            recipes:
              variant.recipes && variant.recipes.length > 0
                ? {
                    create: variant.recipes.map((recipe: any) => ({
                      materialId: recipe.materialId,
                      quantityRequired: recipe.quantityRequired,
                    })),
                  }
                : undefined,
          })),
        },
      },
      include: { variants: { include: { recipes: true } } },
    });

    res.status(201).json({
      success: true,
      data: newProduct,
      message: "Produk berhasil dibuat",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal membuat produk", error });
  }
};

// [PUT] Update Produk (Sistem Re-create Variants & Recipes agar aman dan konsisten)
export const updateProduct = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const productId = parseInt(req.params.id);
    const { categoryId, branchId, name, variants } = req.body;

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Produk tidak valid" });
      return;
    }

    // Pastikan produk milik tenant yang sedang login
    const existingProduct = await db.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existingProduct) {
      res
        .status(404)
        .json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    // Gunakan $transaction untuk memastikan integritas data saat Update Nested Relations
    const updatedProduct = await db.$transaction(async (tx) => {
      // 1. Jika ada payload variants, hapus semua varian lama (Recipes otomatis terhapus karena onDelete: Cascade di schema)
      if (variants) {
        await tx.productVariant.deleteMany({
          where: { productId: productId },
        });
      }

      // 2. Update data base produk sekaligus membuat varian/resep baru (jika ada)
      return await tx.product.update({
        where: { id: productId },
        data: {
          categoryId,
          branchId,
          name,
          ...(variants && {
            variants: {
              create: variants.map((variant: any) => ({
                name: variant.name,
                price: variant.price,
                recipes:
                  variant.recipes && variant.recipes.length > 0
                    ? {
                        create: variant.recipes.map((recipe: any) => ({
                          materialId: recipe.materialId,
                          quantityRequired: recipe.quantityRequired,
                        })),
                      }
                    : undefined,
              })),
            },
          }),
        },
        include: { variants: { include: { recipes: true } } },
      });
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Produk berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal memperbarui produk", error });
  }
};

// [DELETE] Hapus Produk
export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ success: false, message: "ID Produk tidak valid" });
      return;
    }

    const existingProduct = await db.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existingProduct) {
      res
        .status(404)
        .json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    // Berkat onDelete: Cascade di schema.prisma, menghapus Product akan otomatis menghapus Varian & Resepnya.
    await db.product.delete({
      where: { id: productId },
    });

    res.status(200).json({
      success: true,
      message: "Produk beserta varian dan resepnya berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghapus produk",
      error,
    });
  }
};
