import { Router } from 'express';

export const resultsRouter = Router();

resultsRouter.post('/bulk-save', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 3)' });
});
