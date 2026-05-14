import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const tournamentsRouter = Router();

tournamentsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.tournament.findMany({ orderBy: { startDate: 'asc' } });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

tournamentsRouter.get('/:id/matches', async (req, res, next) => {
  try {
    const rows = await prisma.match.findMany({
      where: { tournamentId: req.params.id },
      orderBy: [{ scheduledDate: 'asc' }, { roundLabel: 'asc' }],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

tournamentsRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { leagues: true, groups: true },
    });
    if (!row) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

tournamentsRouter.post('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 2)' });
});

tournamentsRouter.put('/:id', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 2)' });
});
