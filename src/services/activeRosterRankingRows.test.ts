import { describe, expect, it } from 'vitest';
import { mergeActiveRosterRankingRows } from './activeRosterRankingRows.js';

describe('mergeActiveRosterRankingRows', () => {
  it('agrega jugadores activos sin ranking con 0 puntos', async () => {
    const prisma = {
      player: {
        findMany: async () => [
          { id: 'p-l1-demo', name: 'Demo A.', category: 'Primera', profileImage: null },
        ],
      },
      groupPlayer: { findMany: async () => [] },
      tournamentLeague: { findMany: async () => [] },
    };

    const rows = await mergeActiveRosterRankingRows(prisma as never, [], null);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 'p-l1-demo',
      league: 1,
      points: 0,
      played: 0,
      wins: 0,
      losses: 0,
      player: { name: 'Demo A.' },
    });
  });

  it('no reemplaza una fila de ranking materializada existente', async () => {
    const existing = {
      id: 'row-real',
      playerId: 'p-l2-komesu-m',
      league: 2,
      points: 180,
      played: 5,
      wins: 3,
      losses: 2,
      titles: 0,
      finals: 0,
      statsJson: {},
      updatedAt: new Date(),
      player: { id: 'p-l2-komesu-m', name: 'Komesu M.', category: 'Segunda', profileImage: null },
    };
    const prisma = {
      player: {
        findMany: async () => [
          { id: 'p-l2-komesu-m', name: 'Komesu M.', category: 'Segunda', profileImage: null },
        ],
      },
      groupPlayer: { findMany: async () => [] },
      tournamentLeague: { findMany: async () => [] },
    };

    const rows = await mergeActiveRosterRankingRows(prisma as never, [existing], null);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'row-real', playerId: 'p-l2-komesu-m', league: 2, points: 180 });
  });

  it('agrega fila en liga superior si el jugador está en plantel de ese torneo (ascenso)', async () => {
    const prisma = {
      player: {
        findMany: async () => [
          { id: 'p-l6', name: 'Cellilli F.', category: 'Sexta', profileImage: null },
        ],
      },
      groupPlayer: {
        findMany: async () => [
          { playerId: 'p-l6', group: { tournamentId: 't-novak-l6' } },
          { playerId: 'p-l6', group: { tournamentId: 't-novak-l5' } },
        ],
      },
      tournamentLeague: {
        findMany: async () => [
          { tournamentId: 't-novak-l6', leagueNum: 6 },
          { tournamentId: 't-novak-l5', leagueNum: 5 },
        ],
      },
    };

    const rows = await mergeActiveRosterRankingRows(prisma as never, [], null);
    const leagues = rows.map((r) => r.league).sort();

    expect(leagues).toEqual([5, 6]);
    expect(rows.every((r) => r.playerId === 'p-l6')).toBe(true);
  });
});
