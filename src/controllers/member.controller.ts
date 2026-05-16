// src/controllers/member.controller.ts
import { Request, Response } from "express";
import { PointType } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

export const getMembers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const tenantId = req.user!.tenantId;

    // Ambil member yang mendaftar di cabang-cabang milik tenant ini
    const members = await db.member.findMany({
      where: { branch: { tenantId } },
      orderBy: { points: "desc" },
      include: { branch: { select: { name: true } } },
    });
    res.status(200).json({ success: true, data: members });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

export const createMember = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const { branchId, name, phone, email } = req.body;

    const existing = await db.member.findUnique({ where: { phone } });
    if (existing) {
      res.status(400).json({
        success: false,
        message: "Nomor HP sudah terdaftar sebagai member",
      });
      return;
    }

    const member = await db.member.create({
      data: { branchId, name, phone, email, points: 0 },
    });

    res.status(201).json({
      success: true,
      data: member,
      message: "Member berhasil didaftarkan",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal mendaftarkan member", error });
  }
};

export const adjustPoints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db; // Mengambil instance Prisma dari Tenant Middleware
    const memberId = req.params.id;
    const { amount, description } = req.body;

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: String(memberId) },
        data: { points: { increment: amount } },
      });

      await tx.memberPointHistory.create({
        data: {
          memberId : String(memberId),
          type: PointType.ADJUSTMENT,
          amount,
          description,
        },
      });
      return updated;
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Poin member berhasil disesuaikan",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal menyesuaikan poin" });
  }
};
