// src/controllers/attendance.controller.ts
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./shift.controller";
import { AttendanceStatus } from "@prisma/client";

// Clock IN
export const clockIn = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { shiftStart, shiftEnd, photoUrl, location, notes } = req.body;

    // Cek apakah hari ini sudah Clock In
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: { userId, date: { gte: today } },
    });

    if (existing) {
      res
        .status(400)
        .json({
          success: false,
          message: "Anda sudah melakukan Clock In hari ini",
        });
      return;
    }

    // Logika Telat (Late)
    const currentTime = new Date();
    const [startHour, startMin] = shiftStart.split(":");
    const shiftStartTime = new Date();
    shiftStartTime.setHours(Number(startHour), Number(startMin), 0);

    const status =
      currentTime > shiftStartTime
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        clockIn: currentTime,
        date: today,
        shiftStart,
        shiftEnd,
        status,
        photoUrl,
        location,
        notes,
      },
    });

    res
      .status(201)
      .json({ success: true, data: attendance, message: "Berhasil Clock In" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal Clock In", error });
  }
};

// Clock OUT
export const clockOut = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const attendanceId = req.params.id;

    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { clockOut: new Date() },
    });

    res
      .status(200)
      .json({ success: true, data: attendance, message: "Berhasil Clock Out" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal Clock Out", error });
  }
};
