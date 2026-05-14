import 'dotenv/config';
import { resolveDatabaseUrl } from './lib/buildDatabaseUrl.js';

process.env.DATABASE_URL = resolveDatabaseUrl();
