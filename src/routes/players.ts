import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const playersRouter = Router();

playersRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.player.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

playersRouter.post('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 1)' });
});

playersRouter.put('/:id', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 1)' });
});

playersRouter.patch('/:id/status', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 1)' });
});
