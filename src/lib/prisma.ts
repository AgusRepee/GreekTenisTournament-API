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
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = createPrismaClient();
