import type { RequestHandler } from 'express';
import { Router } from 'express';

export const rankingsRouter = Router();

rankingsRouter.get('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 5)' });
});

export const recalculateRankingsHandler: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 5)' });
};

rankingsRouter.post('/recalculate', recalculateRankingsHandler);
