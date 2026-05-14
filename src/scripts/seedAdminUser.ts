import '../envBootstrap.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 12;

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME?.trim() || 'admin';
  const password = process.env.ADMIN_SEED_PASSWORD ?? process.env.ADMIN_PASSWORD;

  if (!password?.trim()) {
    throw new Error('Definí ADMIN_SEED_PASSWORD para crear o actualizar el usuario admin.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await prisma.adminUser.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
    update: {
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`Admin user listo: ${admin.username}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
