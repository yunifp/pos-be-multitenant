// src/controllers/setting.controller.ts
import { Request, Response } from "express";

// Interface untuk memastikan TypeScript mengenali tipe data AuthRequest dan req.user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

export const getSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    const settings = await db.generalSetting.findUnique({
      where: { tenantId },
    });

    res.status(200).json({
      success: true,
      data: settings,
      message: "Berhasil mengambil pengaturan",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const updateSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    const updatedSettings = await db.generalSetting.update({
      where: { tenantId },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      data: updatedSettings,
      message: "Pengaturan berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
