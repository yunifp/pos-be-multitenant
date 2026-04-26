import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import moment from 'moment';

const prisma = new PrismaClient();

export const expenseController = {
  // Ambil Daftar Belanja
  getExpenses: async (req: Request, res: Response) => {
    try {
      const { branchId, startDate, endDate } = req.query;
      const expenses = await prisma.cashFlow.findMany({
        where: {
          branchId: branchId as string,
          type: 'OPERATIONAL',
          date: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          }
        },
        include: { recorder: { select: { fullName: true, role: true } } },
        orderBy: { date: 'desc' }
      });
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Gagal memuat data belanja" });
    }
  },

  createExpense: async (req: Request, res: Response) => {
    try {
      const { branchId, amount, category, description, date, recordedBy, role } = req.body;
      
      // Ambil file dari multer
      // Path disimpan agar bisa diakses: /uploads/receipts/namafile.jpg
      const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

      const expense = await prisma.cashFlow.create({
        data: {
          branchId,
          amount: parseFloat(amount),
          type: 'OPERATIONAL',
          category,
          description,
          receiptUrl, 
          date: new Date(date),
          recordedBy
        }
      });
      res.status(201).json(expense);
    } catch (error) {
      res.status(400).json({ message: "Gagal simpan data ke database" });
    }
  },

  updateExpense: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, category, description, date } = req.body;

      const existing = await prisma.cashFlow.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

      // Jika ada file baru gunakan yang baru, jika tidak gunakan yang lama
      const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : existing.receiptUrl;

      const updated = await prisma.cashFlow.update({
        where: { id },
        data: { 
          amount: amount ? parseFloat(amount) : undefined, 
          category, 
          description, 
          receiptUrl,
          date: date ? new Date(date) : undefined 
        }
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Gagal update data" });
    }
  },

  // Hapus Belanja
  deleteExpense: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.query; // Role dikirim via query atau token

      const existing = await prisma.cashFlow.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

      if (role === 'MANAGER') {
        const isToday = moment(existing.date).isSame(moment(), 'day');
        if (!isToday) return res.status(403).json({ message: "Manager hanya boleh menghapus belanja hari ini" });
      }

      await prisma.cashFlow.delete({ where: { id } });
      res.json({ message: "Berhasil dihapus" });
    } catch (error) {
      res.status(400).json({ message: "Gagal menghapus data" });
    }
  }
};