import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const SECRET = process.env.JWT_SECRET || 'fallback_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '1d';

interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  branchId: string | null;
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};