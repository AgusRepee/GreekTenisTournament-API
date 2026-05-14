import { Router } from 'express';
import jwt from 'jsonwebtoken';

export const authAdminRouter = Router();

/** Login mínimo: contraseña compartida en env (reemplazar por usuarios reales + hash). */
authAdminRouter.post('/login', (req, res) => {
  const password = process.env.ADMIN_PASSWORD?.trim() ?? '';
  if (!password) {
    res.status(503).json({ error: 'ADMIN_PASSWORD no configurado' });
    return;
  }
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'JWT_SECRET no configurado' });
    return;
  }
  const body = req.body as { password?: string };
  if (body?.password !== password) {
    res.status(401).json({ error: 'Credenciales inválidas' });
    return;
  }
  const token = jwt.sign({ sub: 'admin', role: 'admin' }, secret, {
    expiresIn: Number(process.env.JWT_EXPIRES_SECONDS ?? '') || 8 * 60 * 60,
  });
  res.json({ token, tokenType: 'Bearer', expiresInSeconds: Number(process.env.JWT_EXPIRES_SECONDS ?? '') || 28800 });
});
