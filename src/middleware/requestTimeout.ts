import type { Request, Response, NextFunction } from 'express';

export function readRequestTimeoutMs(): number {
  const raw = Number(process.env.REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 3_000 ? Math.floor(raw) : 15_000;
}

/** Cierra requests HTTP que exceden el límite (evita procesos colgados en Hostinger). */
export function requestTimeout(ms = readRequestTimeoutMs()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let closed = false;
    const finish = (status: number, body: { error: string }) => {
      if (closed || res.headersSent) return;
      closed = true;
      res.status(status).json(body);
    };

    req.setTimeout(ms, () => finish(503, { error: 'Request timeout' }));
    res.setTimeout(ms, () => finish(503, { error: 'Request timeout' }));

    res.on('finish', () => {
      closed = true;
    });

    next();
  };
}
