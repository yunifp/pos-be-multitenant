// src/controllers/receipt.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getReceiptSetting = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const branchId = req.params.branchId;
    const setting = await prisma.receiptSetting.findUnique({
      where: { branchId },
    });
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

export const updateReceiptSetting = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const branchId = req.params.branchId;
    const updated = await prisma.receiptSetting.update({
      where: { branchId },
      data: req.body,
    });
    res
      .status(200)
      .json({
        success: true,
        data: updated,
        message: "Pengaturan struk diperbarui",
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};
