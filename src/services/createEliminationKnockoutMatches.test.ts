import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceEliminationMatchesFromBracket } from './createEliminationKnockoutMatches.js';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const tx = {
    match: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    tournamentLeague: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'league-1',
        tournamentId: 't-novak-l5',
      }),
    },
    player: {
      count: vi.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) => {
        const ids = where.id.in;
        if (ids.some((id) => id.startsWith('sys-ko-wait-rp-'))) return Promise.resolve(ids.length);
        if (ids.every((id) => id.startsWith('sys-ko-'))) return Promise.resolve(ids.length);
        return Promise.resolve(ids.length);
      }),
      findMany: vi.fn().mockImplementation(({ where }: { where?: { id?: { in: string[] } } }) => {
        const ids = where?.id?.in ?? [];
        return Promise.resolve(ids.map((id) => ({ id })));
      }),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id.startsWith('p-') ? { id: where.id } : null),
      ),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    ...overrides,
  };
  return { prisma, tx };
}

const bracket = {
  preliminary: [{ id: 'rp-0', slotA: 'p-a', slotB: 'p-b' }],
  quarter: [
    { id: 'qf-0', slotA: 'p-c', slotB: 'WAIT_RP_0' },
    { id: 'qf-1', slotA: 'p-d', slotB: 'p-e' },
    { id: 'qf-2', slotA: 'p-f', slotB: 'p-g' },
    { id: 'qf-3', slotA: 'p-h', slotB: 'p-i' },
  ],
};

describe('replaceEliminationMatchesFromBracket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza si faltan placeholders WAIT_RP en la base', async () => {
    const { prisma } = mockPrisma({
      player: {
        count: vi.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) => {
          const ids = where.id.in;
          if (ids.includes('sys-ko-wait-rp-0')) return Promise.resolve(0);
          return Promise.resolve(ids.length);
        }),
      },
    });
    const result = await replaceEliminationMatchesFromBracket(prisma as never, 'league-1', bracket);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/sys-ko-wait-rp/i);
  });

  it('borra solo partidos con prefijo ko-{tid}- (no fixture de grupos)', async () => {
    const { prisma, tx } = mockPrisma();
    const result = await replaceEliminationMatchesFromBracket(prisma as never, 'league-1', bracket);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.created).toBe(8);
    expect(tx.match.deleteMany).toHaveBeenCalledWith({
      where: { id: { startsWith: 'ko-t-novak-l5-' } },
    });
    expect(tx.match.create).toHaveBeenCalled();
  });

  it('rechaza cuartos incompletos', async () => {
    const { prisma } = mockPrisma();
    const incomplete = {
      preliminary: [],
      quarter: [{ id: 'qf-0', slotA: 'p-a', slotB: null }],
    };
    const result = await replaceEliminationMatchesFromBracket(prisma as never, 'league-1', incomplete);
    expect(result.ok).toBe(false);
  });
});
