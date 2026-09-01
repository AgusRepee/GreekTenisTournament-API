import type { PrismaClient } from '@prisma/client';
import { isRepechageWaitPlayerId, resolveBracketSlotPlayerId } from './koRepechagePlaceholders.js';

/** Ids embebidos del frontend (`liga3Data.ts`) → nombre corto del torneo. */
const LEGACY_NOVAK_L3_ID_TO_NAME: Record<string, string> = {
  'l3-pusterla': 'Pusterla P.',
  'l3-santi-mat': 'Santi Mat.',
  'l3-rusel': 'Rusel S.',
  'l3-bocchicchio': 'Bocchicchio F.',
  'l3-repecka': 'Repecka A.',
  'l3-marin': 'Marin G.',
  'l3-fernandez': 'Fernandez B.',
  'l3-casadio': 'Casadio M.',
  'l3-aguirre': 'Aguirre W.',
  'l3-bianco': 'Bianco D.',
  'l3-vito': 'Bauerkamper G.',
  'l3-santi-g': 'Santi G.',
  'l3-delvalle': 'Del Valle G.',
  'l3-ferreres': 'Ferreres G.',
  'l3-figueroa': 'Figueroa M.',
};

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function findPlayerIdByDisplayName(prisma: PrismaClient, displayName: string): Promise<string | null> {
  const key = normName(displayName);
  const all = await prisma.player.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const hit = all.find((p) => normName(p.name) === key || normName(p.displayName ?? '') === key);
  return hit?.id ?? null;
}

/**
 * Traduce ids del borrador admin (p-l3-*, l3-*, name:*) al id Prisma persistido en `Match`.
 */
export async function resolveEliminationPlayerId(
  prisma: PrismaClient,
  raw: string | null | undefined,
): Promise<string | null> {
  const token = resolveBracketSlotPlayerId(raw);
  if (!token) return null;
  if (isRepechageWaitPlayerId(token) || token.startsWith('sys-ko-')) return token;

  const direct = await prisma.player.findUnique({ where: { id: token }, select: { id: true } });
  if (direct) return direct.id;

  if (token.startsWith('name:')) {
    return findPlayerIdByDisplayName(prisma, token.slice(5));
  }

  const legacyName = LEGACY_NOVAK_L3_ID_TO_NAME[token];
  if (legacyName) {
    const byLegacy = await findPlayerIdByDisplayName(prisma, legacyName);
    if (byLegacy) return byLegacy;
  }

  if (token.startsWith('l3-') || token.startsWith('p-l3-') || token.startsWith('p-novak-l3-')) {
    const byRaw = await findPlayerIdByDisplayName(prisma, token);
    if (byRaw) return byRaw;
  }

  return null;
}
