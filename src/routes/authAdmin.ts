import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const authAdminRouter = Router();

type AdminLoginBody = {
  username?: string;
  password?: string;
};

function jwtExpirySeconds(): number {
  return Number(process.env.JWT_EXPIRES_SECONDS ?? '') || 8 * 60 * 60;
}

function signAdminToken(payload: { sub: string; role: string; username: string }, secret: string) {
  const expiresIn = jwtExpirySeconds();
  return {
    token: jwt.sign(payload, secret, { expiresIn }),
    expiresInSeconds: expiresIn,
  };
}

/** Login admin: usuarios MySQL con hash. Fallback temporal a ADMIN_PASSWORD si aún no existe AdminUser. */
authAdminRouter.post('/login', async (req, res, next) => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'JWT_SECRET no configurado' });
    return;
  }

  try {
    const body = req.body as AdminLoginBody;
    const username = body?.username?.trim() || 'admin';
    const password = body?.password ?? '';
    if (!password) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const adminCount = await prisma.adminUser.count();
    if (adminCount > 0) {
      const admin = await prisma.adminUser.findUnique({ where: { username } });
      if (!admin?.isActive) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
      const ok = await bcrypt.compare(password, admin.passwordHash);
      if (!ok) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
      const token = signAdminToken({ sub: admin.id, role: admin.role, username: admin.username }, secret);
      res.json({ ...token, tokenType: 'Bearer' });
      return;
    }

    const fallbackPassword = process.env.ADMIN_PASSWORD?.trim() ?? '';
    if (!fallbackPassword) {
      res.status(503).json({ error: 'ADMIN_PASSWORD no configurado y no existen usuarios admin' });
      return;
    }
    if (username !== 'admin' || password !== fallbackPassword) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const token = signAdminToken({ sub: 'env-admin', role: 'admin', username: 'admin' }, secret);
    res.json({ ...token, tokenType: 'Bearer' });
  } catch (err) {
    next(err);
  }
});
