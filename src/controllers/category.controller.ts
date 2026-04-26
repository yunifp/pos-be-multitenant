import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// --- CREATE CATEGORY ---
export const createCategory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, targetBranchIds } = req.body;

    let branchesToConnect: { id: string }[] = [];

    if (user.role === Role.OWNER) {
      if (!targetBranchIds || targetBranchIds.length === 0) {
        return res.status(400).json({ message: "Pilih minimal satu cabang" });
      }
      branchesToConnect = targetBranchIds.map((id: string) => ({ id }));
    } else {
      // Manager otomatis ke cabangnya sendiri
      branchesToConnect = [{ id: user.branchId }];
    }

    await prisma.category.create({
      data: {
        name,
        branches: { connect: branchesToConnect }
      }
    });

    return res.status(201).json({ message: "Kategori berhasil dibuat" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal membuat kategori" });
  }
};

// --- GET CATEGORIES (Filter by Branch) ---
export const getCategories = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { branchId } = req.query;

    let whereClause: any = { deletedAt: null, isActive: true };

    if (user.role === Role.OWNER) {
        if (branchId) {
            // If branchId is provided (e.g., clicked a tab), filter by it.
            whereClause.branches = { some: { id: branchId as string } };
        } 
        // [FIX] If NO branchId is provided, return ALL categories.
        // This allows the Product Form Modal to populate the dropdown.
    } else {
        // Managers only see their branch categories
        whereClause.branches = { some: { id: user.branchId } };
    }

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } } 
    });

    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
};
// --- UPDATE CATEGORY (NEW) ---
export const updateCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        await prisma.category.update({
            where: { id: parseInt(id) },
            data: { name }
        });

        return res.json({ message: "Kategori berhasil diperbarui" });
    } catch (error) {
        return res.status(500).json({ message: "Gagal update kategori" });
    }
};

// --- DELETE CATEGORY ---
export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.category.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() } // Soft Delete
        });
        return res.json({ message: "Kategori dihapus" });
    } catch (error) {
        return res.status(500).json({ message: "Gagal hapus kategori" });
    }
};