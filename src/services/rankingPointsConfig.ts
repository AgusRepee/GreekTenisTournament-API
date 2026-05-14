/**
 * Puntos de ranking: fase alcanzada (tipo ATP 500) + partidos de fase de grupos.
 * Opcional: `TournamentLeague.rulesJson.rankingPoints` (objeto anidado o plano legacy).
 */

import type { PlayerReachedPhase, TournamentPhaseMatch } from './rankingPhase.js';
import { getPlayerReachedPhase, isGroupPhaseMatch } from './rankingPhase.js';

export type RankingPointsStageReached = {
  champion: number;
  finalist: number;
  semifinalist: number;
  quarterfinalist: number;
  repechageLoser: number;
  groupStage: number;
};

export type RankingPointsGroupMatches = {
  win: number;
  loss: number;
  walkoverWin: number;
  walkoverLoss: number;
};

export type RankingPointsConfig = {
  stageReached: RankingPointsStageReached;
  groupMatches: RankingPointsGroupMatches;
};

/** Overrides parciales desde `rulesJson` (por liga). */
export type RankingPointsRulesPatch = {
  stageReached?: Partial<RankingPointsStageReached>;
  groupMatches?: Partial<RankingPointsGroupMatches>;
};

/** Valores por defecto del club (documentados también en docs/hostinger-backend-mysql.md). */
export const DEFAULT_RANKING_POINTS: RankingPointsConfig = {
  stageReached: {
    champion: 500,
    finalist: 350,
    semifinalist: 200,
    quarterfinalist: 100,
    repechageLoser: 50,
    groupStage: 25,
  },
  groupMatches: {
    win: 25,
    loss: 5,
    walkoverWin: 15,
    walkoverLoss: 0,
  },
};

export type TournamentPhase =
  | 'champion'
  | 'finalist'
  | 'semifinalist'
  | 'quarterfinalist'
  | 'repechage'
  | 'group_participant'
  | 'none';

export type TournamentPointsBreakdown = {
  points: number;
  stagePoints: number;
  groupMatchPoints: number;
  phase: TournamentPhase;
  playedInTournament: boolean;
};

function inMatch(playerId: string, m: TournamentPhaseMatch): boolean {
  return m.playerA === playerId || m.playerB === playerId;
}

export function mergePointsTable(base: RankingPointsConfig, patch?: RankingPointsRulesPatch | null): RankingPointsConfig {
  if (!patch) return base;
  return {
    stageReached: { ...base.stageReached, ...patch.stageReached },
    groupMatches: { ...base.groupMatches, ...patch.groupMatches },
  };
}

function numRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function numVal(p: Record<string, unknown>, k: string): number | undefined {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Acepta formato anidado `{ stageReached, groupMatches }` o plano legacy (solo fase). */
export function parseRankingPointsFromRulesJson(rulesJson: unknown): RankingPointsRulesPatch | null {
  if (!rulesJson || typeof rulesJson !== 'object' || Array.isArray(rulesJson)) return null;
  const o = rulesJson as Record<string, unknown>;
  const rp = o.rankingPoints;
  const flat = numRecord(rp);
  if (!flat) return null;

  const nestedStage = numRecord(flat.stageReached);
  const nestedGroup = numRecord(flat.groupMatches);

  const stagePatch: Partial<RankingPointsStageReached> = {};
  const groupPatch: Partial<RankingPointsGroupMatches> = {};

  if (nestedStage) {
    const c = numVal(nestedStage, 'champion');
    const f = numVal(nestedStage, 'finalist');
    const s = numVal(nestedStage, 'semifinalist');
    const q = numVal(nestedStage, 'quarterfinalist');
    const r = numVal(nestedStage, 'repechageLoser');
    const g = numVal(nestedStage, 'groupStage');
    if (c !== undefined) stagePatch.champion = c;
    if (f !== undefined) stagePatch.finalist = f;
    if (s !== undefined) stagePatch.semifinalist = s;
    if (q !== undefined) stagePatch.quarterfinalist = q;
    if (r !== undefined) stagePatch.repechageLoser = r;
    if (g !== undefined) stagePatch.groupStage = g;
  }

  if (nestedGroup) {
    const w = numVal(nestedGroup, 'win');
    const l = numVal(nestedGroup, 'loss');
    const ww = numVal(nestedGroup, 'walkoverWin');
    const wl = numVal(nestedGroup, 'walkoverLoss');
    if (w !== undefined) groupPatch.win = w;
    if (l !== undefined) groupPatch.loss = l;
    if (ww !== undefined) groupPatch.walkoverWin = ww;
    if (wl !== undefined) groupPatch.walkoverLoss = wl;
  }

  // Legacy: claves en la raíz de `rankingPoints`
  if (!nestedStage) {
    const c = numVal(flat, 'champion');
    const f = numVal(flat, 'finalist');
    const s = numVal(flat, 'semifinalist');
    const q = numVal(flat, 'quarterfinalist');
    const r = numVal(flat, 'repechageLoser') ?? numVal(flat, 'repechage');
    const g = numVal(flat, 'groupStage') ?? numVal(flat, 'groupParticipant');
    if (c !== undefined) stagePatch.champion = c;
    if (f !== undefined) stagePatch.finalist = f;
    if (s !== undefined) stagePatch.semifinalist = s;
    if (q !== undefined) stagePatch.quarterfinalist = q;
    if (r !== undefined) stagePatch.repechageLoser = r;
    if (g !== undefined) stagePatch.groupStage = g;
  }

  const out: RankingPointsRulesPatch = {};
  if (Object.keys(stagePatch).length) out.stageReached = stagePatch;
  if (Object.keys(groupPatch).length) out.groupMatches = groupPatch;
  return Object.keys(out).length ? out : null;
}

function mapReachedToPhase(p: PlayerReachedPhase): TournamentPhase {
  switch (p) {
    case 'champion':
      return 'champion';
    case 'finalist':
      return 'finalist';
    case 'semifinalist':
      return 'semifinalist';
    case 'quarterfinalist':
      return 'quarterfinalist';
    case 'repechage':
      return 'repechage';
    case 'group_stage':
      return 'group_participant';
    default:
      return 'none';
  }
}

export function pointsForPhase(phase: TournamentPhase, stage: RankingPointsStageReached): number {
  switch (phase) {
    case 'champion':
      return stage.champion;
    case 'finalist':
      return stage.finalist;
    case 'semifinalist':
      return stage.semifinalist;
    case 'quarterfinalist':
      return stage.quarterfinalist;
    case 'repechage':
      return stage.repechageLoser;
    case 'group_participant':
      return stage.groupStage;
    default:
      return 0;
  }
}

export function groupMatchRankingPointsForPlayer(
  playerId: string,
  phaseMatches: TournamentPhaseMatch[],
  gm: RankingPointsGroupMatches,
): number {
  let pts = 0;
  for (const m of phaseMatches) {
    if (!isGroupPhaseMatch(m)) continue;
    if (!inMatch(playerId, m)) continue;
    const w = m.winnerId;
    if (w == null || String(w).trim() === '') continue;
    const won = w === playerId;
    const st = m.groupResultStatus ?? 'played';
    if (st === 'walkover') {
      pts += won ? gm.walkoverWin : gm.walkoverLoss;
    } else {
      pts += won ? gm.win : gm.loss;
    }
  }
  return pts;
}

export function tournamentPointsFromPhaseMatches(
  playerId: string,
  phaseMatches: TournamentPhaseMatch[],
  pointsTable: RankingPointsConfig,
): TournamentPointsBreakdown {
  const reached = getPlayerReachedPhase(playerId, phaseMatches);
  const phase = mapReachedToPhase(reached);
  const groupPts = groupMatchRankingPointsForPlayer(playerId, phaseMatches, pointsTable.groupMatches);

  const stageEligible =
    phase === 'champion' ||
    phase === 'finalist' ||
    phase === 'semifinalist' ||
    phase === 'quarterfinalist' ||
    phase === 'repechage' ||
    phase === 'group_participant';

  const stagePts = stageEligible ? pointsForPhase(phase, pointsTable.stageReached) : 0;
  const points = stagePts + groupPts;

  if (stageEligible) {
    return { points, stagePoints: stagePts, groupMatchPoints: groupPts, phase, playedInTournament: true };
  }

  const anyMatch = phaseMatches.some((m) => inMatch(playerId, m));
  if (anyMatch) {
    return {
      points,
      stagePoints: 0,
      groupMatchPoints: groupPts,
      phase: 'none',
      playedInTournament: true,
    };
  }

  return { points: 0, stagePoints: 0, groupMatchPoints: 0, phase: 'none', playedInTournament: false };
}

/** Alineado a `TournamentCatalogType` en Prisma y `TournamentCatalogType` del frontend. */
export type TournamentRankingCatalogType = 'greek500' | 'masters1000';

/** Masters Greek 1000: misma forma que Greek 500 con peso doble en torneo + grupos (ajustable vía `rulesJson`). */
export const DEFAULT_RANKING_POINTS_MASTERS_1000: RankingPointsConfig = {
  stageReached: {
    champion: 1000,
    finalist: 700,
    semifinalist: 400,
    quarterfinalist: 200,
    repechageLoser: 100,
    groupStage: 50,
  },
  groupMatches: {
    win: 50,
    loss: 10,
    walkoverWin: 30,
    walkoverLoss: 0,
  },
};

export function normalizePrismaTournamentCatalogType(raw: string | null | undefined): TournamentRankingCatalogType {
  return raw === 'masters1000' ? 'masters1000' : 'greek500';
}

function isMastersFinalsTournamentRow(t: { id: string; name: string }): boolean {
  const id = t.id?.trim();
  if (id === 't-masters') return true;
  const n = (t.name ?? '').trim();
  return /\bmaster\s*finals\b/i.test(n) || /\bmasters?\s+finals?\b/i.test(n);
}

/** Greek 500 por defecto; solo Masters Finals usa Masters 1000 (ignora columna `tournamentType`). */
export function effectivePrismaTournamentCatalogType(t: { id: string; name: string; tournamentType?: string | null }): TournamentRankingCatalogType {
  return isMastersFinalsTournamentRow(t) ? 'masters1000' : 'greek500';
}

export function defaultRankingPointsForCatalogType(kind: TournamentRankingCatalogType): RankingPointsConfig {
  return kind === 'masters1000' ? DEFAULT_RANKING_POINTS_MASTERS_1000 : DEFAULT_RANKING_POINTS;
}

export function countSemifinalTournaments(playerId: string, phaseMatchesByTournament: Map<string, TournamentPhaseMatch[]>): number {
  let n = 0;
  for (const [, matches] of phaseMatchesByTournament) {
    if (getPlayerReachedPhase(playerId, matches) === 'semifinalist') n += 1;
  }
  return n;
}
