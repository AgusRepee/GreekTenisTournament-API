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
      match: {
        findMany: async () => [],
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
});
