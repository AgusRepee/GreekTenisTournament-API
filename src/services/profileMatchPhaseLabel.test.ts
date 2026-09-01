import { describe, it, expect } from 'vitest';
import {
  buildProfileMatchPhaseLabel,
  groupPhaseFromGroupKey,
  knockoutStageFromRoundLabel,
  knockoutStageFromToken,
  parseScheduleDateIso,
} from './profileMatchPhaseLabel.js';

describe('profileMatchPhaseLabel', () => {
  it('traduce tokens KO técnicos', () => {
    expect(knockoutStageFromToken('ko_sf')).toBe('Semifinal');
    expect(knockoutStageFromToken('ko_qf')).toBe('Cuartos de final');
    expect(knockoutStageFromToken('ko_final')).toBe('Final');
    expect(knockoutStageFromToken('repechaje')).toBe('Repechaje');
  });

  it('no expone group_ko como etiqueta cruda', () => {
    expect(groupPhaseFromGroupKey('group_ko')).toBeNull();
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Rafael Nadal',
        leagueNum: 1,
        groupKey: 'B',
      }),
    ).toBe('Rafael Nadal · Liga 1 · Grupo B');
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Novak Djokovic',
        leagueNum: 1,
        matchStage: 'semifinal',
        roundLabel: 'Semifinales',
      }),
    ).toBe('Novak Djokovic · Liga 1 · Semifinal');
  });

  it('usa roundLabel legible para eliminatoria', () => {
    expect(knockoutStageFromRoundLabel('Cuartos de final')).toBe('Cuartos de final');
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Torneo',
        leagueNum: 4,
        groupKey: 'KO-ko_qf',
        matchId: 'ko_qf',
      }),
    ).toBe('Torneo · Liga 4 · Cuartos de final');
  });

  it('no duplica liga cuando el torneo ya la incluye en el nombre', () => {
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Novak Djokovic - Liga 1',
        leagueNum: 1,
        matchStage: 'semifinal',
      }),
    ).toBe('Novak Djokovic · Liga 1 · Semifinal');
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Rafael Nadal - Liga 1',
        leagueNum: 1,
        groupKey: 'B',
      }),
    ).toBe('Rafael Nadal · Liga 1 · Grupo B');
  });

  it('traduce IDs largos de partido KO', () => {
    expect(knockoutStageFromToken('ko-t-novak-l2-sf-0')).toBe('Semifinal');
    expect(
      buildProfileMatchPhaseLabel({
        tournamentName: 'Novak Djokovic',
        leagueNum: 2,
        groupKey: 'KO-ko-t-novak-l2-sf-0',
        matchId: 'ko-t-novak-l2-sf-0',
      }),
    ).toBe('Novak Djokovic · Liga 2 · Semifinal');
  });

  it('parsea fechas del fixture programado', () => {
    expect(parseScheduleDateIso('2026-06-13')).toBe('2026-06-13');
    expect(parseScheduleDateIso('')).toBeUndefined();
  });
});
