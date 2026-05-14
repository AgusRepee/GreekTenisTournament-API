import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';

export const authAdminRouter = Router();

type AdminLoginBody = {
  email?: string;
  username?: string;
  password?: string;
};

type ForgotPasswordBody = {
  email?: string;
};

type ResetPasswordBody = {
  token?: string;
  password?: string;
};

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

function jwtExpirySeconds(): number {
  return Number(process.env.JWT_EXPIRES_SECONDS ?? '') || 8 * 60 * 60;
}

function normalizeEmail(input: string | undefined): string {
  return input?.trim().toLowerCase() ?? '';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAdminToken(payload: { sub: string; role: string; email: string; username: string }, secret: string) {
  const expiresIn = jwtExpirySeconds();
  return {
    token: jwt.sign(payload, secret, { expiresIn }),
    expiresInSeconds: expiresIn,
  };
}

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? '');
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const config = smtpConfig();
  if (!config) {
    throw new Error('SMTP no configurado');
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject: 'Recuperar contraseña - Greek Tennis',
    text: `Para cambiar tu contraseña de administrador, abrí este enlace: ${resetUrl}\n\nEl enlace vence en 1 hora.`,
    html: `<p>Para cambiar tu contraseña de administrador, abrí este enlace:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>El enlace vence en 1 hora.</p>`,
  });
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
    const email = normalizeEmail(body?.email ?? body?.username);
    const password = body?.password ?? '';
    if (!email || !password) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const adminCount = await prisma.adminUser.count();
    if (adminCount > 0) {
      const admin = await prisma.adminUser.findUnique({ where: { email } });
      if (!admin?.isActive) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
      const ok = await bcrypt.compare(password, admin.passwordHash);
      if (!ok) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
      const token = signAdminToken(
        { sub: admin.id, role: admin.role, email: admin.email ?? email, username: admin.username },
        secret,
      );
      res.json({ ...token, tokenType: 'Bearer' });
      return;
    }

    const fallbackPassword = process.env.ADMIN_PASSWORD?.trim() ?? '';
    const fallbackEmail = normalizeEmail(process.env.ADMIN_SEED_EMAIL) || 'agustinrepecka@gmail.com';
    if (!fallbackPassword) {
      res.status(503).json({ error: 'ADMIN_PASSWORD no configurado y no existen usuarios admin' });
      return;
    }
    if (email !== fallbackEmail || password !== fallbackPassword) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const token = signAdminToken({ sub: 'env-admin', role: 'admin', email: fallbackEmail, username: 'admin' }, secret);
    res.json({ ...token, tokenType: 'Bearer' });
  } catch (err) {
    next(err);
  }
});

authAdminRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const body = req.body as ForgotPasswordBody;
    const email = normalizeEmail(body?.email);
    if (!email) {
      res.status(400).json({ error: 'Email requerido' });
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (admin?.isActive) {
      if (!smtpConfig()) {
        res.status(503).json({ error: 'SMTP no configurado para recuperar contraseña' });
        return;
      }
      const token = randomBytes(RESET_TOKEN_BYTES).toString('hex');
      const tokenHash = hashToken(token);
      await prisma.adminPasswordResetToken.deleteMany({
        where: {
          adminUserId: admin.id,
          usedAt: null,
          expiresAt: { lt: new Date() },
        },
      });
      await prisma.adminPasswordResetToken.create({
        data: {
          adminUserId: admin.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '') || 'https://greektennis.com';
      await sendPasswordResetEmail(email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
    }

    res.json({ ok: true, message: 'Si el email existe, enviamos un enlace para recuperar la contraseña.' });
  } catch (err) {
    next(err);
  }
});

authAdminRouter.post('/reset-password', async (req, res, next) => {
  try {
    const body = req.body as ResetPasswordBody;
    const token = body?.token?.trim() ?? '';
    const password = body?.password ?? '';
    if (!token || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      return;
    }

    const reset = await prisma.adminPasswordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { adminUser: true },
    });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now() || !reset.adminUser.isActive) {
      res.status(400).json({ error: 'El enlace es inválido o expiró.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: reset.adminUserId },
        data: { passwordHash },
      }),
      prisma.adminPasswordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
