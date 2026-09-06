import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 40;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * If req.ip still resolves to a loopback/private address, the app can't tell
 * visitors apart (misconfigured or unexpected reverse-proxy setup) — bucketing
 * everyone under one key would rate-limit the whole site off a few visitors'
 * combined traffic. Fail open instead of turning a proxy quirk into an outage.
 */
function isUnreliableClientIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(ip)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(ip)) return true;
  return false;
}

/** Limita tráfico a catálogo público (rankings, players, tournaments, news). */
export function publicRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  if (isUnreliableClientIp(key)) {
    next();
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (bucket.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: 'Too many requests. Try again shortly.' });
    return;
  }
  bucket.count += 1;
  next();
}
