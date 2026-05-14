import './envBootstrap.js';
import cors from 'cors';
import express from 'express';
import { authAdminRouter } from './routes/authAdmin.js';
import { adminApiRouter } from './routes/adminApiRouter.js';
import { publicRouter } from './routes/public.js';
import { newsRouter } from './routes/news.js';
import { requireAdminJwt } from './middleware/requireAdminJwt.js';

export function createApp(): express.Application {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'greek-tennis-api' });
  });

  app.use('/api/public', publicRouter);
  app.use('/api/news', newsRouter);

  /** Login admin sin JWT (body JSON `{ password }`). */
  app.use('/api/admin/auth', authAdminRouter);

  /** Rutas operación protegidas. */
  app.use('/api/admin', requireAdminJwt, adminApiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
