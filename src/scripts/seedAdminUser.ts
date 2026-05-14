import '../envBootstrap.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 12;

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME?.trim() || 'admin';
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase() || 'agustinrepecka@gmail.com';
  const password = process.env.ADMIN_SEED_PASSWORD ?? process.env.ADMIN_PASSWORD;

  if (!password?.trim()) {
    throw new Error('Definí ADMIN_SEED_PASSWORD para crear o actualizar el usuario admin.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await prisma.adminUser.upsert({
    where: { username },
    create: {
      username,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
    update: {
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`Admin user listo: ${admin.email ?? admin.username}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
