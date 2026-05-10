// src/controllers/shift.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// 1. Buat Shift Master
export const createShift = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const shift = await prisma.shift.create({ data: req.body });
    res
      .status(201)
      .json({
        success: true,
        data: shift,
        message: "Shift master berhasil dibuat",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal membuat shift", error });
  }
};

export const getShifts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string;
    const shifts = await prisma.shift.findMany({
      where: { branchId },
      include: { _count: { select: { assignments: true } } },
    });
    res.status(200).json({ success: true, data: shifts });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

// 2. Assign Shift ke Karyawan (Jadwal Kerja)
export const assignShift = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId, shiftId, date } = req.body;

    // Konversi date string YYYY-MM-DD ke ISO Date UTC
    const parsedDate = new Date(`${date}T00:00:00Z`);

    const assignment = await prisma.employeeShift.upsert({
      where: { userId_date: { userId, date: parsedDate } },
      update: { shiftId },
      create: { userId, shiftId, date: parsedDate },
    });

    res
      .status(200)
      .json({
        success: true,
        data: assignment,
        message: "Jadwal shift karyawan diperbarui",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal memetakan shift", error });
  }
};
