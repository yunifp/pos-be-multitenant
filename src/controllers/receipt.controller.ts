// src/controllers/receipt.controller.ts
import { Request, Response } from "express";

// Interface untuk memastikan TypeScript mengenali tipe data AuthRequest
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

export const getReceiptSetting = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const branchId = req.params.branchId;

    const setting = await db.receiptSetting.findUnique({
      where: { branchId: String(branchId) },
    });

    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

export const updateReceiptSetting = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const branchId = req.params.branchId;

    const updated = await db.receiptSetting.update({
      where: { branchId: String(branchId) },
      data: req.body,
    });

    res.status(200).json({
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
