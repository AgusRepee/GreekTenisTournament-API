import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const newsRouter = Router();

newsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.news.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

newsRouter.post('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 6)' });
});

newsRouter.put('/:id', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 6)' });
});

newsRouter.patch('/:id/status', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 6)' });
});
