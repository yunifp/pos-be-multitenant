// src/controllers/product.controller.ts
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

// [GET] Ambil Semua Produk
export const getProducts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const products = await db.product.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
      include: {
        category: { select: { name: true } },
        // Ambil resep langsung dari produk tunggal (jika ada)
        recipes: {
          include: { material: { select: { name: true, unit: true } } },
        },
        // Ambil varian dan resep varian (jika ada)
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
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const productId = parseInt(idString);

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
        recipes: {
          include: {
            material: { select: { name: true, unit: true, costPerUnit: true } },
          },
        },
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
    const db = req.db;
    const tenantId = req.user!.tenantId;

    // hasVariant (Boolean) menentukan mode produk (Tunggal vs Varian)
    const {
      categoryId,
      branchId,
      name,
      hasVariant,
      price,
      trackStock,
      stock,
      recipes,
      variants,
    } = req.body;

    const newProduct = await db.product.create({
      data: {
        tenantId,
        categoryId,
        branchId,
        name,
        hasVariant: hasVariant || false,

        // --- DATA PRODUK TUNGGAL ---
        price: hasVariant ? null : price,
        trackStock: hasVariant ? false : trackStock || false,
        stock: hasVariant ? null : stock || 0,

        // Jika produk TUNGGAL punya resep (F&B)
        ...(!hasVariant &&
          recipes &&
          recipes.length > 0 && {
            recipes: {
              create: recipes.map((recipe: any) => ({
                materialId: recipe.materialId,
                quantityRequired: recipe.quantityRequired,
              })),
            },
          }),

        // --- DATA PRODUK VARIAN ---
        // Jika produk VARIAN, masukkan list variannya
        ...(hasVariant &&
          variants &&
          variants.length > 0 && {
            variants: {
              create: variants.map((variant: any) => ({
                name: variant.name,
                price: variant.price,
                trackStock: variant.trackStock || false,
                stock: variant.stock || 0,
                // Varian F&B yang punya resep masing-masing
                ...(variant.recipes &&
                  variant.recipes.length > 0 && {
                    recipes: {
                      create: variant.recipes.map((recipe: any) => ({
                        materialId: recipe.materialId,
                        quantityRequired: recipe.quantityRequired,
                      })),
                    },
                  }),
              })),
            },
          }),
      },
      include: {
        recipes: true,
        variants: { include: { recipes: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: newProduct,
      message: "Produk berhasil dibuat",
    });
  } catch (error) {
    console.error("Error create product:", error);
    res
      .status(500)
      .json({ success: false, message: "Gagal membuat produk", error });
  }
};

// [PUT] Update Produk
export const updateProduct = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const productId = parseInt(idString);

    const {
      categoryId,
      branchId,
      name,
      hasVariant,
      price,
      trackStock,
      stock,
      recipes,
      variants,
    } = req.body;

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

    // Gunakan $transaction untuk memastikan integritas data
    const updatedProduct = await db.$transaction(async (tx) => {
      await tx.recipe.deleteMany({ where: { productId: productId } });
      await tx.productVariant.deleteMany({ where: { productId: productId } });

      // 2. MASUKKAN DATA BARU
      return await tx.product.update({
        where: { id: productId },
        data: {
          categoryId,
          branchId,
          name,
          hasVariant: hasVariant || false,

          price: hasVariant ? null : price,
          trackStock: hasVariant ? false : trackStock || false,
          stock: hasVariant ? null : stock || 0,

          ...(!hasVariant &&
            recipes &&
            recipes.length > 0 && {
              recipes: {
                create: recipes.map((recipe: any) => ({
                  materialId: recipe.materialId,
                  quantityRequired: recipe.quantityRequired,
                })),
              },
            }),

          ...(hasVariant &&
            variants &&
            variants.length > 0 && {
              variants: {
                create: variants.map((variant: any) => ({
                  name: variant.name,
                  price: variant.price,
                  trackStock: variant.trackStock || false,
                  stock: variant.stock || 0,
                  ...(variant.recipes &&
                    variant.recipes.length > 0 && {
                      recipes: {
                        create: variant.recipes.map((recipe: any) => ({
                          materialId: recipe.materialId,
                          quantityRequired: recipe.quantityRequired,
                        })),
                      },
                    }),
                })),
              },
            }),
        },
        include: {
          recipes: true,
          variants: { include: { recipes: true } },
        },
      });
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Produk berhasil diperbarui",
    });
  } catch (error) {
    console.error("Error update product:", error);
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
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const idParam = req.params.id;
    const idString = Array.isArray(idParam) ? idParam[0] : (idParam as string);
    const productId = parseInt(idString);

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

    // Berkat onDelete: Cascade di schema.prisma, menghapus Product akan otomatis menghapus:
    // 1. Resep Produk Tunggal
    // 2. Varian-variannya
    // 3. Resep dari Varian tersebut
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
