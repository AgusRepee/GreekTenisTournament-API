import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { parseMysqlConnectionConfig, resolveDatabaseUrl } from './buildDatabaseUrl.js';

function createPrismaClient(): PrismaClient {
  process.env.DATABASE_URL = resolveDatabaseUrl();
  const cfg = parseMysqlConnectionConfig();
  const adapter = new PrismaMariaDb({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: 5,
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as typeof globalThis & { __greekPrisma?: PrismaClient };

/** Una sola instancia por proceso Passenger/Node (pool limitado en hosting compartido). */
export const prisma = globalForPrisma.__greekPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__greekPrisma = prisma;
}
