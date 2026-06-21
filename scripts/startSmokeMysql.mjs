/**
 * MySQL aislado para smoke API (ephemeral MySQL 8.4, puerto libre).
 * Ejecutar en background: node scripts/startSmokeMysql.mjs
 */
import { createDB } from 'mysql-memory-server';
import mariadb from 'mariadb';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, '..');
const ROOT = resolve(API_ROOT, '..');
const API_ENV = resolve(API_ROOT, '.env');
const STATE = resolve(ROOT, 'tools/.smoke-mysql.json');

const DB_NAME = 'greek_tennis_dev';
const DB_USER = 'greek_dev';
const DB_PASS = 'GreekDev1234!';

console.log('[smoke-mysql] Iniciando MySQL 8.4 ephemeral…');
const db = await createDB({
  version: '8.4.4',
  dbName: DB_NAME,
});

const rootConn = await mariadb.createConnection({
  host: '127.0.0.1',
  port: db.port,
  user: db.username,
  password: db.password ?? '',
  database: db.dbName,
  allowPublicKeyRetrieval: true,
});

await rootConn.query(`DROP USER IF EXISTS '${DB_USER}'@'%'`);
await rootConn.query(`DROP USER IF EXISTS '${DB_USER}'@'localhost'`);
await rootConn.query(
  `CREATE USER '${DB_USER}'@'%' IDENTIFIED WITH caching_sha2_password BY '${DB_PASS}'`,
);
await rootConn.query(`GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%'`);
await rootConn.query('FLUSH PRIVILEGES');
const plugins = await rootConn.query(`SELECT user, host, plugin FROM mysql.user WHERE user=?`, [DB_USER]);
console.table(plugins);
await rootConn.end();

const databaseUrl = `mysql://${DB_USER}:${encodeURIComponent(DB_PASS)}@127.0.0.1:${db.port}/${DB_NAME}?allowPublicKeyRetrieval=true`;

if (existsSync(API_ENV)) {
  writeFileSync(`${API_ENV}.bak-smoke`, readFileSync(API_ENV, 'utf8'), 'utf8');
}
writeFileSync(
  API_ENV,
  [
    `DATABASE_URL="${databaseUrl}"`,
    'PORT=3001',
    'JWT_SECRET="dev-secret"',
    'ADMIN_SEED_USERNAME="admin"',
    'ADMIN_SEED_PASSWORD="1234"',
    'CORS_ORIGIN="http://localhost:3000"',
    '# smoke-mysql ephemeral',
  ].join('\n') + '\n',
  'utf8',
);

writeFileSync(
  STATE,
  JSON.stringify({ port: db.port, database: DB_NAME, user: DB_USER, plugin: 'caching_sha2_password', databaseUrl }, null, 2),
  'utf8',
);

console.log('[smoke-mysql] OK port=', db.port);
console.log('[smoke-mysql] Dejar este proceso corriendo durante migrate/API/smoke');

process.on('SIGINT', async () => {
  await db.stop();
  process.exit(0);
});
setInterval(() => {}, 60_000);
