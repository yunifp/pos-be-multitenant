import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
/**
 * MENGAMBIL DAFTAR MEMBER
 * Owner: Bisa melihat semua atau filter per cabang
 * Manager: Hanya melihat member di cabangnya sendiri
 */
export const getMembers = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { branchId, search } = req.query;

        let whereClause: any = {};

        // Filter berdasarkan Role
        if (user.role === 'OWNER') {
            if (branchId && branchId !== 'all') {
                whereClause.branchId = branchId;
            }
        } else {
            // Manager dikunci ke cabangnya sendiri
            whereClause.branchId = user.branchId;
        }

        // Filter Pencarian Nama atau HP
        if (search) {
            whereClause.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string } }
            ];
        }

        const members = await prisma.member.findMany({
            where: whereClause,
            include: { 
                branch: { select: { name: true } } // Mengambil nama cabang untuk UI
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(members);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data member" });
    }
};

/**
 * MENAMBAH MEMBER BARU
 */
export const createMember = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { name, phone, email, branchId } = req.body;

        // Validasi: Manager tidak boleh membuat member di cabang lain
        const targetBranchId = user.role === 'OWNER' ? (branchId || user.branchId) : user.branchId;

        const newMember = await prisma.member.create({
            data: {
                name,
                phone,
                email,
                branchId: targetBranchId
            }
        });

        res.status(201).json(newMember);
    } catch (error: any) {
        // Cek jika nomor HP duplikat (Unique constraint di Prisma)
        if (error.code === 'P2002') {
            return res.status(400).json({ message: "Nomor HP sudah terdaftar" });
        }
        res.status(500).json({ message: "Gagal menambah member" });
    }
};

/**
 * MEMPERBARUI DATA MEMBER
 */
export const updateMember = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;
        const { name, phone, email, branchId } = req.body;

        // Cek apakah member ada
        const existingMember = await prisma.member.findUnique({ where: { id } });
        if (!existingMember) return res.status(404).json({ message: "Member tidak ditemukan" });

        // Proteksi: Manager tidak boleh edit member cabang lain
        if (user.role !== 'OWNER' && existingMember.branchId !== user.branchId) {
            return res.status(403).json({ message: "Anda tidak memiliki akses ke data ini" });
        }

        const updatedMember = await prisma.member.update({
            where: { id },
            data: {
                name,
                phone,
                email,
                branchId: user.role === 'OWNER' ? (branchId || existingMember.branchId) : user.branchId
            }
        });

        res.json(updatedMember);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: "Nomor HP sudah digunakan oleh member lain" });
        }
        res.status(500).json({ message: "Gagal memperbarui data member" });
    }
};

/**
 * MENGHAPUS MEMBER
 */
export const deleteMember = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;

        // Cek akses sebelum hapus
        if (user.role !== 'OWNER') {
            const member = await prisma.member.findUnique({ where: { id } });
            if (member?.branchId !== user.branchId) {
                return res.status(403).json({ message: "Akses ditolak" });
            }
        }

        await prisma.member.delete({ where: { id } });
        res.json({ message: "Member berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: "Gagal menghapus member" });
    }
};


export const verifyMember = async (req: Request, res: Response) => {
    try {
        // Ambil dari params karena rutenya /:phone
        const { phone } = req.params; 

        if (!phone) {
            return res.status(400).json({ message: "Nomor HP diperlukan" });
        }

        const member = await prisma.member.findFirst({
            where: { 
                phone: String(phone), // Pastikan tipe data sesuai (String)
                isActive: true 
            }
        });

        if (!member) {
            return res.status(404).json({ message: "Member tidak ditemukan" });
        }

        res.json(member);
    } catch (error) {
        res.status(500).json({ message: "Error server saat verifikasi member" });
    }
};