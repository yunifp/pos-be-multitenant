import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const parseBody = (value: any) => {
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
};

// --- CREATE PRODUCT ---
export const createProduct = async (req: Request, res: Response) => {
  // [DEBUG] Cek apakah file masuk
  console.log("--- DEBUG UPLOAD ---");
  console.log("FILE:", req.file); 
  console.log("BODY:", req.body);

  try {
    const user = (req as any).user;
    let { 
      name, description, categoryId, hasVariants, variants, 
      singlePrice, singleHpp, singleStock, singleSku, singleManageStock, 
      targetBranchIds 
    } = req.body;

    variants = parseBody(variants);
    targetBranchIds = parseBody(targetBranchIds);
    hasVariants = String(hasVariants) === 'true'; 
    singleManageStock = String(singleManageStock) === 'true';

    // [FIX] Path gambar
    const imagePath = req.file ? `/uploads/products/${req.file.filename}` : undefined;

    if (!name) return res.status(400).json({ message: "Nama produk wajib diisi" });
    const parsedCategoryId = parseInt(categoryId);
    if (!parsedCategoryId) return res.status(400).json({ message: "Kategori wajib dipilih" });

    let branchesToInsert: string[] = [];
    if (user.role === Role.OWNER) {
      if (!targetBranchIds || targetBranchIds.length === 0) return res.status(400).json({ message: "Pilih minimal satu cabang" });
      branchesToInsert = targetBranchIds;
    } else {
      branchesToInsert = [user.branchId];
    }

    let variantsTemplate: any[] = [];
    if (hasVariants && variants && variants.length > 0) {
        variantsTemplate = variants.map((v: any) => ({
            name: v.name,
            price: parseFloat(v.price || 0),
            hpp: parseFloat(v.hpp || 0),
            stock: parseInt(v.stock || 0),
            sku: v.sku,
            manageStock: v.manageStock ?? true
        }));
    } else {
        variantsTemplate = [{
            name: 'Standard',
            price: parseFloat(singlePrice || 0),
            hpp: parseFloat(singleHpp || 0),
            stock: parseInt(singleStock || 0),
            sku: singleSku,
            manageStock: singleManageStock ?? true
        }];
    }

    await Promise.all(branchesToInsert.map(async (branchId) => {
        await prisma.category.update({
            where: { id: parsedCategoryId },
            data: { branches: { connect: { id: branchId } } }
        });

        const newProduct = await prisma.product.create({
            data: {
                name, 
                description, 
                image: imagePath, // Save Path
                hasVariants,
                branch: { connect: { id: branchId } },
                category: { connect: { id: parsedCategoryId } }
            }
        });

        for (const vTempl of variantsTemplate) {
            const newVariant = await prisma.productVariant.create({
                data: {
                    productId: newProduct.id,
                    name: vTempl.name,
                    price: vTempl.price,
                    hpp: vTempl.hpp,
                    sku: vTempl.sku,
                    manageStock: vTempl.manageStock,
                    stock: vTempl.stock
                }
            });

            if (vTempl.manageStock) {
                await prisma.productStock.create({
                    data: {
                        branchId: branchId,
                        variantId: newVariant.id,
                        quantity: vTempl.stock,
                        price: vTempl.price,
                        hpp: vTempl.hpp
                    }
                });
            }
        }
    }));

    return res.status(201).json({ message: "Produk berhasil dibuat" });

  } catch (error) {
    console.error("Create Product Error:", error);
    return res.status(500).json({ message: "Gagal membuat produk" });
  }
};

// --- UPDATE PRODUCT ---
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        let { name, description, categoryId, variants, hasVariants } = req.body;

        variants = parseBody(variants);
        hasVariants = String(hasVariants) === 'true';
        const parsedCategoryId = parseInt(categoryId);
        const imagePath = req.file ? `/uploads/products/${req.file.filename}` : undefined;

        const updateData: any = {
            name,
            description,
            hasVariants,
            category: { connect: { id: parsedCategoryId } }
        };

        if (imagePath) updateData.image = imagePath;

        // 1. Update data dasar produk
        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        if (variants && Array.isArray(variants)) {
            // --- LOGIKA SYNC VARIANT ---
            
            // Ambil semua ID varian yang dikirim dari frontend
            const incomingVariantIds = variants.filter(v => v.id).map(v => parseInt(v.id));

            // Hapus varian di DB yang tidak ada di list incoming (jika user menghapus varian saat edit)
            await prisma.productVariant.updateMany({
                where: { 
                    productId: product.id,
                    id: { notIn: incomingVariantIds }
                },
                data: {
                    isActive: false
                }
            });

            for (const v of variants) {
                const variantData = {
                    name: v.name,
                    price: parseFloat(v.price || 0),
                    hpp: parseFloat(v.hpp || 0),
                    stock: parseInt(v.stock || 0),
                    sku: v.sku,
                    manageStock: String(v.manageStock) === 'true'
                };

                if (v.id) {
                    // A. UPDATE varian yang sudah ada
                    const updatedVar = await prisma.productVariant.update({
                        where: { id: parseInt(v.id) },
                        data: variantData
                    });

                    if (variantData.manageStock) {
                        await prisma.productStock.upsert({
                            where: { branchId_variantId: { branchId: product.branchId, variantId: updatedVar.id } },
                            update: { quantity: variantData.stock, price: variantData.price, hpp: variantData.hpp },
                            create: { branchId: product.branchId, variantId: updatedVar.id, quantity: variantData.stock, price: variantData.price, hpp: variantData.hpp }
                        });
                    }
                } else {
                    // B. CREATE varian baru (Kunci perbaikan Anda di sini)
                    const newVar = await prisma.productVariant.create({
                        data: {
                            ...variantData,
                            productId: product.id
                        }
                    });

                    if (variantData.manageStock) {
                        await prisma.productStock.create({
                            data: {
                                branchId: product.branchId,
                                variantId: newVar.id,
                                quantity: variantData.stock,
                                price: variantData.price,
                                hpp: variantData.hpp
                            }
                        });
                    }
                }
            }
        }
        
        return res.json({ message: "Produk berhasil diperbarui" });
    } catch (error) {
        console.error("Update Error:", error);
        return res.status(500).json({ message: "Gagal update produk" });
    }
};

// --- GET & DELETE ---
export const getProducts = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { branchId } = req.query; 
        let whereClause: any = { deletedAt: null };
        if (user.role === 'OWNER') {
            if (branchId) whereClause.branchId = branchId as string;
        } else {
            whereClause.branchId = user.branchId;
        }
        const products = await prisma.product.findMany({
            where: whereClause,
            include: { branch: { select: { id: true, name: true } }, category: true, variants: { where: { isActive: true }, include: { stocks: true, promotionTargets: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(products);
    } catch (error) { return res.status(500).json({ message: "Error" }); }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.product.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
        return res.json({ message: "Produk berhasil dihapus" });
    } catch (error) { return res.status(500).json({ message: "Gagal hapus produk" }); }
};