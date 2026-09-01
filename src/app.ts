import './envBootstrap.js';
import cors from 'cors';
import express from 'express';
import { authAdminRouter } from './routes/authAdmin.js';
import { adminApiRouter } from './routes/adminApiRouter.js';
import { publicRouter } from './routes/public.js';
import { newsRouter } from './routes/news.js';
import { requireAdminJwt } from './middleware/requireAdminJwt.js';
import { authRateLimit } from './middleware/authRateLimit.js';
import { publicRateLimit } from './middleware/publicRateLimit.js';
import { requestTimeout } from './middleware/requestTimeout.js';
import { QueryTimeoutError } from './lib/queryTimeout.js';

export function createApp(): express.Application {
  const app = express();
  const corsEnv = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
  const corsOrigin = corsEnv?.length ? corsEnv : process.env.NODE_ENV === 'production' ? false : true;

  app.use(cors({ origin: corsOrigin }));
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(requestTimeout());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'greek-tennis-api' });
  });

  app.use('/api/public', publicRateLimit, publicRouter);
  app.use('/api/news', publicRateLimit, newsRouter);

  /** Login admin sin JWT (body JSON `{ password }`). */
  app.use('/api/admin/auth', authRateLimit, authAdminRouter);

  /** Rutas operación protegidas. */
  app.use('/api/admin', requireAdminJwt, adminApiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof QueryTimeoutError) {
      console.error(err.message);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Service temporarily unavailable' });
      }
      return;
    }
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}
