import { describe, expect, it } from 'vitest';
import { mergeActiveRosterRankingRows } from './activeRosterRankingRows.js';

describe('mergeActiveRosterRankingRows', () => {
  it('agrega jugadores inscriptos sin ranking con 0 puntos', async () => {
    const prisma = {
      groupPlayer: {
        findMany: async () => [
          {
            player: { id: 'p-l1-demo', name: 'Demo A.', category: 'Primera', profileImage: null },
            group: { tournament: { leagues: [{ leagueNum: 1 }] } },
          },
        ],
      },
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
      groupPlayer: {
        findMany: async () => [
          {
            player: { id: 'p-l2-komesu-m', name: 'Komesu M.', category: 'Segunda', profileImage: null },
            group: { tournament: { leagues: [{ leagueNum: 2 }] } },
          },
        ],
      },
    };

    const rows = await mergeActiveRosterRankingRows(prisma as never, [existing], null);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'row-real', playerId: 'p-l2-komesu-m', league: 2, points: 180 });
  });
});
