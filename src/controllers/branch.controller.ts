import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- CREATE BRANCH ---
export const createBranch = async (req: Request, res: Response) => {
  try {
    const { name, address, phone, latitude, longitude, radius } = req.body;

    if (!name) return res.status(400).json({ message: "Nama cabang wajib diisi" });

    const branch = await prisma.branch.create({
      data: { 
        name, 
        address, 
        phone,
        // Pastikan konversi ke Float/Int
        latitude: latitude ? parseFloat(latitude) : 0, 
        longitude: longitude ? parseFloat(longitude) : 0,
        radius: radius ? parseInt(radius) : 50 // Default 50 meter
      }
    });

    return res.status(201).json({ message: "Cabang berhasil dibuat", data: branch });
  } catch (error) {
    return res.status(500).json({ message: "Gagal membuat cabang" });
  }
};

// --- UPDATE BRANCH ---
export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, phone, latitude, longitude, radius } = req.body;

    await prisma.branch.update({
      where: { id },
      data: { 
        name, 
        address, 
        phone,
        latitude: latitude ? parseFloat(latitude) : undefined, 
        longitude: longitude ? parseFloat(longitude) : undefined,
        radius: radius ? parseInt(radius) : undefined
      }
    });

    return res.json({ message: "Cabang berhasil diperbarui" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal update cabang" });
  }
};

// ... (GET & DELETE TETAP SAMA)
export const getAllBranches = async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(branches);
  } catch (error) { return res.status(500).json({ message: "Gagal ambil data" }); }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.json({ message: "Cabang dihapus" });
  } catch (error) { return res.status(500).json({ message: "Gagal hapus" }); }
};

export const getBranchById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const branch = await prisma.branch.findUnique({ where: { id } });
  return res.json(branch);
};