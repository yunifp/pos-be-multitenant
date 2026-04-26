import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string; // Ambil token dari URL jika ada

  let token = '';

  // 1. Cek token di Authorization Header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Jika tidak ada di header, cek di Query Parameter (untuk fitur Export)
  else if (queryToken) {
    token = queryToken;
  }

  // Jika di kedua tempat tidak ada token
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token missing' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  // --- Tetap gunakan as any untuk menyimpan user ---
  (req as any).user = decoded;
  
  next();
};

export const authorizeRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};