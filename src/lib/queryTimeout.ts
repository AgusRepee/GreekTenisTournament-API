export class QueryTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Query timeout (${label}, ${ms}ms)`);
    this.name = 'QueryTimeoutError';
  }
}

export function readQueryTimeoutMs(): number {
  const raw = Number(process.env.QUERY_TIMEOUT_MS ?? process.env.REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? Math.floor(raw) : 12_000;
}

/** Corta consultas Prisma que no respondan a tiempo (libera el worker de Express). */
export async function withQueryTimeout<T>(promise: Promise<T>, label: string, ms?: number): Promise<T> {
  const limit = ms ?? readQueryTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new QueryTimeoutError(label, limit)), limit);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
