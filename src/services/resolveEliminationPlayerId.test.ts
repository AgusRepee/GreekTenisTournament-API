import { describe, it, expect, vi } from 'vitest';
import { resolveEliminationPlayerId } from './resolveEliminationPlayerId.js';

const L3_PLAYERS = [
  { id: 'p-l3-santi-g', name: 'Santi G.', displayName: 'Santi G.' },
  { id: 'p-l3-del-valle-g', name: 'Del Valle G.', displayName: 'Del Valle G.' },
  { id: 'p-l3-casadio-m', name: 'Casadio M.', displayName: 'Casadio M.' },
];

function mockPrisma(extra: Record<string, unknown> = {}) {
  return {
    player: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const hit = L3_PLAYERS.find((p) => p.id === where.id);
        return Promise.resolve(hit ? { id: hit.id } : null);
      }),
      findMany: vi.fn(() => Promise.resolve(L3_PLAYERS)),
    },
    ...extra,
  };
}

describe('resolveEliminationPlayerId', () => {
  it('conserva ids Prisma existentes', async () => {
    const prisma = mockPrisma();
    await expect(resolveEliminationPlayerId(prisma as never, 'p-l3-santi-g')).resolves.toBe('p-l3-santi-g');
  });

  it('traduce ids legacy l3-* por nombre', async () => {
    const prisma = mockPrisma();
    await expect(resolveEliminationPlayerId(prisma as never, 'l3-santi-g')).resolves.toBe('p-l3-santi-g');
    await expect(resolveEliminationPlayerId(prisma as never, 'l3-delvalle')).resolves.toBe('p-l3-del-valle-g');
  });

  it('traduce WAIT_RP a sys-ko-wait-rp', async () => {
    const prisma = mockPrisma();
    await expect(resolveEliminationPlayerId(prisma as never, 'WAIT_RP_0')).resolves.toBe('sys-ko-wait-rp-0');
  });
});
