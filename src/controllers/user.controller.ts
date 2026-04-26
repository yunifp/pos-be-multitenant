import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// --- TAMBAH USER ---
export const createUser = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { fullName, email, password, pin, role, branchId } = req.body;

    // 1. Tentukan Cabang
    let targetBranchId = branchId;
    
    // Jika yang request bukan Owner (misal Manager), paksa ke cabang dia sendiri
    if (currentUser.role !== 'OWNER') {
        targetBranchId = currentUser.branchId;
    }

    // Validasi: Kecuali Owner baru, user lain wajib punya cabang
    if (!targetBranchId && role !== 'OWNER') {
        return res.status(400).json({ message: "Cabang wajib dipilih untuk karyawan" });
    }

    // 2. Hash Password & PIN
    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        pinHash,
        role: role as Role,
        branchId: targetBranchId,
        isActive: true
      }
    });

    return res.status(201).json({ message: "Pengguna berhasil dibuat", data: newUser });

  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ message: "Email sudah digunakan" });
    console.error(error);
    return res.status(500).json({ message: "Gagal membuat pengguna" });
  }
};

// --- AMBIL DATA USER ---
export const getUsers = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { branchId } = req.query;

    let filterBranchId = currentUser.branchId;

    // Jika Owner, boleh filter bebas. Jika belum pilih cabang, return kosong.
    if (currentUser.role === 'OWNER') {
        if (branchId) filterBranchId = branchId as string;
        else return res.json([]); 
    }

    const users = await prisma.user.findMany({
      where: {
        branchId: filterBranchId,
        isActive: true, 
        deletedAt: null 
      },
      select: { // Keamanan: Jangan kirim passwordHash ke frontend
        id: true, fullName: true, email: true, role: true, branchId: true, branch: true, phone: true
      },
      orderBy: { fullName: 'asc' }
    });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data pengguna" });
  }
};

// --- UPDATE USER ---
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, pin, role, branchId } = req.body;

    const updateData: any = { fullName, email, role };
    
    // Hanya update password/pin jika diisi
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
    if (pin) updateData.pinHash = await bcrypt.hash(pin, 10);
    if (branchId) updateData.branchId = branchId;

    await prisma.user.update({
      where: { id },
      data: updateData
    });

    return res.json({ message: "Data pengguna diperbarui" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal update pengguna" });
  }
};

// --- HAPUS USER (Soft Delete) ---
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() } // Soft delete agar riwayat transaksi aman
    });
    return res.json({ message: "Pengguna dihapus" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal hapus pengguna" });
  }
};