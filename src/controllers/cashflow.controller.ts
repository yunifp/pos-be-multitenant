// src/controllers/cashflow.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./pos.controller";

export const getCashFlows = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string;
    const filter = branchId
      ? { branchId }
      : { branch: { tenantId: req.user!.tenantId } };

    const cashflows = await prisma.cashFlow.findMany({
      where: filter,
      orderBy: { date: "desc" },
      include: { recorder: { select: { fullName: true } } },
    });
    res.status(200).json({ success: true, data: cashflows });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

export const createCashFlow = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { branchId, amount, type, category, description } = req.body;

    const cashflow = await prisma.cashFlow.create({
      data: {
        branchId,
        amount,
        type,
        category,
        description,
        recordedBy: req.user!.id,
      },
    });
    res
      .status(201)
      .json({
        success: true,
        data: cashflow,
        message: "Catatan kas berhasil ditambahkan",
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal mencatat kas" });
  }
};
