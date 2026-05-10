import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const settings = await prisma.generalSetting.findUnique({
      where: { tenantId },
    });

    res
      .status(200)
      .json({
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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const updatedSettings = await prisma.generalSetting.update({
      where: { tenantId },
      data: req.body,
    });

    res
      .status(200)
      .json({
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
