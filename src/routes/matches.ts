import { Router } from 'express';

export const matchesRouter = Router();

matchesRouter.post('/:id/result', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented (fase 3)' });
});
