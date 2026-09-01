type CacheEntry<T> = { value: T; expiresAt: number };

/** Caché en memoria con TTL. Una sola instancia por proceso Node. */
export class TimedCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

export function readPublicCacheTtlMs(): number {
  const raw = Number(process.env.PUBLIC_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 120_000;
}
