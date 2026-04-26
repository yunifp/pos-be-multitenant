import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export const getCashFlows = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { branchId, startDate, endDate, type } = req.query;

        let whereClause: any = {
            // Filter agar tidak mengambil tipe OPERATIONAL sesuai permintaan
            type: type ? (type as any) : { in: ['INCOME', 'EXPENSE'] }
        };

        if (user.role === 'OWNER') {
            if (branchId && branchId !== 'all') whereClause.branchId = branchId;
        } else {
            whereClause.branchId = user.branchId;
        }

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        const data = await prisma.cashFlow.findMany({
            where: whereClause,
            include: { 
                branch: { select: { name: true } },
                recorder: { select: { fullName: true } }
            },
            orderBy: { date: 'desc' }
        });

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data kas" });
    }
};

export const createCashFlow = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { amount, type, category, description, date, branchId } = req.body;

        const newEntry = await prisma.cashFlow.create({
            data: {
                amount,
                type,
                category,
                description,
                date: date ? new Date(date) : new Date(),
                recordedBy: user.id,
                branchId: user.role === 'OWNER' ? (branchId || user.branchId) : user.branchId
            }
        });

        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ message: "Gagal mencatat kas" });
    }
};

// updateCashFlow dan deleteCashFlow hanya untuk Owner
export const updateCashFlow = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, type, category, description, date, branchId } = req.body;
        const updatedEntry = await prisma.cashFlow.update({
            where: { id },
            data: {
                amount,
                type,
                category,
                description,
                date: date ? new Date(date) : undefined,
                branchId
            }
        });
        res.json(updatedEntry);
    } catch (error) {
        res.status(500).json({ message: "Gagal memperbarui data" });
    }
};

export const deleteCashFlow = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.cashFlow.delete({ where: { id } });
        res.json({ message: "Data kas berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: "Gagal menghapus data" });
    }
};