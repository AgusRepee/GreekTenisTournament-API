import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const auditRouter = Router();

auditRouter.get('/', async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
