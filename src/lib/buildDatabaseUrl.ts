/**
 * Si no viene DATABASE_URL, arma la URL desde DB_* (Hostinger / .env por piezas).
 */
export function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = process.env.DB_PORT ?? '3306';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? '';
  const name = process.env.DB_NAME;
  if (!user || !name) {
    throw new Error(
      'Falta DATABASE_URL o el conjunto DB_HOST, DB_USER, DB_NAME (y opcionalmente DB_PASSWORD, DB_PORT).',
    );
  }
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `mysql://${encUser}:${encPass}@${host}:${port}/${name}`;
}
