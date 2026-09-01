import type { MatchResult, Player } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import {
  buildNameToId,
  buildScheduleLeagueByDedupeKey,
  linkedMatchForResult,
  linkedMatchIdForResult,
  normName,
  prismaMatchToPhase,
  resolveLeagueForResult,
} from './phaseMatchIndex.js';

describe('normName', () => {
  it('ignora diferencias de tilde al comparar', () => {
    expect(normName('Monzón M.')).toBe(normName('Monzon M.'));
    expect(normName('Ríos J.')).toBe(normName('Rios J.'));
  });
});

describe('buildNameToId', () => {
  it('resuelve el mismo id para variantes con y sin tilde', () => {
    const players = [{ id: 'p-1', name: 'Monzon M.', displayName: null, category: 'Segunda' }] as unknown as Player[];
    const m = buildNameToId(players);
    expect(m.get(normName('Monzón M.'))).toBe('p-1');
    expect(m.get(normName('Monzon M.'))).toBe('p-1');
  });
});

describe('resolveLeagueForResult', () => {
  it('usa leagueNum del fixture cuando el torneo tiene varias ligas', () => {
    const schedule = buildScheduleLeagueByDedupeKey([
      { dedupeKey: 't-rafa-nadal|5|B|repecka a.|mayer d.', leagueNum: 2 },
    ]);
    const leaguesByTournament = new Map([['t-rafa-nadal', [2, 3]]]);
    const ln = resolveLeagueForResult(
      {
        dedupeKey: 't-rafa-nadal|5|B|repecka a.|mayer d.',
        tournamentId: 't-rafa-nadal',
        matchId: null,
      } as MatchResult,
      new Map(),
      leaguesByTournament,
      schedule,
    );
    expect(ln).toBe(2);
  });
});

describe('vínculos de resultado KO', () => {
  it('deduce el Match desde groupKey cuando falta matchId', () => {
    expect(
      linkedMatchIdForResult({ matchId: null, groupKey: 'KO-ko-t-rafa-nadal-l3-qf-0' } as MatchResult),
    ).toBe('ko-t-rafa-nadal-l3-qf-0');
  });

  it('deduce un partido de grupo sin matchId por grupo y fecha', () => {
    const match = {
      id: 'rafa-l3-17',
      tournamentId: 't-rafa-nadal-l3',
      stage: 'group',
      roundLabel: 'Grupo B - Fecha 4',
      group: { key: 'B', displayName: 'Grupo B' },
    };
    const linked = linkedMatchForResult(
      { matchId: null, groupKey: 'B', roundNum: 4, tournamentId: 't-rafa-nadal-l3' } as MatchResult,
      new Map([[match.id, match as never]]),
    );
    expect(linked?.id).toBe('rafa-l3-17');
  });

  it('usa los lados del Match para el ganador aunque exista un homónimo', () => {
    const phase = prismaMatchToPhase(
      {
        stage: 'group',
        player1Id: 'p-l3-fernandez-b',
        player2Id: 'p-l3-aguirre-w',
        winnerId: 'p-l4-fernandez-b',
        completed: true,
        group: { key: 'B', displayName: 'Grupo B' },
      } as never,
      {
        status: 'played',
        score: '7-5 / 6-2',
      } as MatchResult,
    );
    expect(phase?.winnerId).toBe('p-l3-fernandez-b');
  });
});
