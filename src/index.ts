import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
