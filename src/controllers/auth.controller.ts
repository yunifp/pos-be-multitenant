import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema Validasi Input (pakai Zod biar aman)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const pinSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().length(6), // PIN harus 6 digit
});

export const login = async (req: Request, res: Response) => {
  try {
    // 1. Validasi Input
    const { email, password } = loginSchema.parse(req.body);

    // 2. Cari User
    const user = await prisma.user.findUnique({
      where: { email },
      include: { branch: true }, // Include info cabang biar frontend tau
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Email atau Password salah atau akun tidak aktif' });
    }

    // 3. Cek Password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau Password salah' });
    }

    // 4. Buat Token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    });

    // 5. Response
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.fullName,
        role: user.role,
        branch: user.branch ? {
            id: user.branch.id,
            name: user.branch.name,
            latitude: user.branch.latitude,
            longitude: user.branch.longitude,
            radius: user.branch.radius
        } : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// --- FITUR KHUSUS: UNLOCK PAKAI PIN ---
export const unlockSession = async (req: Request, res: Response) => {
  try {
    // 1. Validasi (Frontend kirim userId yang sedang terkunci & PIN)
    const { userId, pin } = pinSchema.parse(req.body);

    // 2. Cari User
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 3. Cek PIN Hash (Pastikan pinHash tidak null)
    if (!user.pinHash) {
      return res.status(400).json({ message: 'PIN not set for this user' });
    }

    const isMatch = await bcrypt.compare(pin, user.pinHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    // 4. Generate Token Baru (Refresh session)
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    });

    return res.json({
      message: 'Session unlocked',
      token,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  // Tambahkan (req as any) agar TypeScript tidak protes
  const user = (req as any).user; 
  return res.json({ user });
};