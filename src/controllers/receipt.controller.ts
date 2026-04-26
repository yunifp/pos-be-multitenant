// src/controllers/receipt.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const receiptController = {
    // Ambil setting struk berdasarkan branchId
    getSetting: async (req: Request, res: Response) => {
        try {
            const { branchId } = req.params;
            let setting = await prisma.receiptSetting.findUnique({
                where: { branchId }
            });

            // Jika belum ada, buatkan default (fallback)
            if (!setting) {
                setting = await prisma.receiptSetting.create({
                    data: { branchId, storeName: 'EPS POS STORE' }
                });
            }
            res.json(setting);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    },

    // Update setting struk
    updateSetting: async (req: Request, res: Response) => {
        try {
            const { branchId } = req.params;
            const data = req.body;

            const updated = await prisma.receiptSetting.update({
                where: { branchId },
                data: data
            });
            res.json(updated);
        } catch (error: any) {
            res.status(400).json({ message: "Gagal memperbarui pengaturan struk" });
        }
    }
};