import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAdminJwt(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'JWT_SECRET no configurado en el servidor' });
    return;
  }
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Se requiere Bearer token' });
    return;
  }
  try {
    jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
