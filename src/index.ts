import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { readRequestTimeoutMs } from './middleware/requestTimeout.js';

const app = createApp();
const port = Number(process.env.PORT) || 3001;

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

const httpTimeoutMs = readRequestTimeoutMs() + 2_000;
server.requestTimeout = httpTimeoutMs;
server.headersTimeout = httpTimeoutMs + 1_000;
server.keepAliveTimeout = 5_000;

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
