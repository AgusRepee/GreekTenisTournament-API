import type { Match, MatchResult, PrismaClient } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { walkoverWinnerIsPlayerB, walkoverAggForLoser, walkoverAggForWinner } from './walkoverWinnerSide.js';
import { normName } from './phaseMatchIndex.js';
import { isInterzonalGroupKey } from './interzonalGroupKey.js';
import {
  buildMergedGroupRosterWithMeta,
  fullNameMatchesShortTournamentName,
  lookupRosterEntry,
  tournamentShortName,
  type PlayerNameRef,
  type RosterEntry,
} from './playerTournamentDisplay.js';

export type PublicGroupStandingRow = {
  position: number;
  playerId: string;
  playerName: string;
  PJ: number;
  PG: number;
  PP: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  setDiff: number;
};

export type PublicGroupStandingsGroup = {
  key: string;
  name: string;
  rows: PublicGroupStandingRow[];
};

export type PublicGroupStandingsPayload = {
  tournamentId: string;
  groups: PublicGroupStandingsGroup[];
};

type Agg = {
  playerId: string;
  playerName: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

function formatGroupName(key: string): string {
  if (key.toLowerCase() === 'interzonal') return 'Interzonal';
  if (/^[A-Z]$/i.test(key)) return `Grupo ${key.toUpperCase()}`;
  return key;
}

function addAgg(m: Map<string, Agg>, playerId: string, playerName: string, patch: Partial<Agg>) {
  const cur = m.get(playerId) ?? {
    playerId,
    playerName,
    played: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  };
  m.set(playerId, {
    playerId,
    playerName,
    played: cur.played + (patch.played ?? 0),
    wins: cur.wins + (patch.wins ?? 0),
    losses: cur.losses + (patch.losses ?? 0),
    setsWon: cur.setsWon + (patch.setsWon ?? 0),
    setsLost: cur.setsLost + (patch.setsLost ?? 0),
    gamesWon: cur.gamesWon + (patch.gamesWon ?? 0),
    gamesLost: cur.gamesLost + (patch.gamesLost ?? 0),
  });
}

function addAggScoped(
  m: Map<string, Agg>,
  playerId: string,
  playerName: string,
  patch: Partial<Agg>,
  rosterIds?: Set<string>,
) {
  if (rosterIds && !rosterIds.has(playerId)) return;
  addAgg(m, playerId, playerName, patch);
}

function resultTouchesGroupRoster(r: Pick<MatchResult, 'playerA' | 'playerB'>, nameToId: Map<string, RosterEntry>): boolean {
  return Boolean(nameToId.get(normName(r.playerA)) || nameToId.get(normName(r.playerB)));
}

function isKnockoutGroupKey(groupKey: string | null | undefined): boolean {
  return /^KO-/i.test((groupKey ?? '').trim());
}

function groupStatsDedupeKey(r: Pick<MatchResult, 'matchId' | 'dedupeKey'>): string {
  return r.matchId?.trim() || r.dedupeKey;
}

function isNormalGroupLetterKey(groupKey: string): boolean {
  return /^[A-Z]$/i.test(groupKey.trim());
}

function ingestMatchRowForGroup(
  m: Match & {
    player1: { id: string; name: string; displayName: string | null };
    player2: { id: string; name: string; displayName: string | null };
    winner: { id: string; name: string } | null;
  },
  nameToId: Map<string, RosterEntry>,
  agg: Map<string, Agg>,
  rosterIds?: Set<string>,
): void {
  if (!m.winnerId || !m.player1Id || !m.player2Id) return;
  const pA = {
    id: m.player1Id,
    name: m.player1.name,
    displayName: m.player1.displayName,
  };
  const pB = {
    id: m.player2Id,
    name: m.player2.name,
    displayName: m.player2.displayName,
  };
  const entryA = lookupRosterEntry(pA, nameToId);
  const entryB = lookupRosterEntry(pB, nameToId);
  const idA = entryA?.id ?? pA.id;
  const idB = entryB?.id ?? pB.id;
  const labelA = entryA?.tournamentName ?? tournamentShortName(pA);
  const labelB = entryB?.tournamentName ?? tournamentShortName(pB);

  const score = (m.score ?? '').trim();
  const wo = /^[AB]$/i.test(score) || /\bW\.?O\.?\b/i.test(score);
  if (wo) {
    const winIsB = m.winnerId === pB.id;
    const winAgg = walkoverAggForWinner(winIsB);
    const lossAgg = walkoverAggForLoser();
    addAggScoped(agg, idA, labelA, winIsB ? { played: 1, losses: 1, ...lossAgg } : { played: 1, wins: 1, ...winAgg }, rosterIds);
    addAggScoped(agg, idB, labelB, winIsB ? { played: 1, wins: 1, ...winAgg } : { played: 1, losses: 1, ...lossAgg }, rosterIds);
    return;
  }

  const winA = m.winnerId === pA.id;
  const det = parseKoPlayedScoreDetail(score, /\bRET\.?\b/i.test(score));
  if (!det.ok) {
    addAggScoped(agg, idA, labelA, { played: 1, wins: winA ? 1 : 0, losses: winA ? 0 : 1 }, rosterIds);
    addAggScoped(agg, idB, labelB, { played: 1, wins: winA ? 0 : 1, losses: winA ? 1 : 0 }, rosterIds);
    return;
  }
  if (winA) {
    addAggScoped(agg, idA, labelA, {
      played: 1,
      wins: 1,
      setsWon: det.setsWonA,
      setsLost: det.setsWonB,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    }, rosterIds);
    addAggScoped(agg, idB, labelB, {
      played: 1,
      losses: 1,
      setsWon: det.setsWonB,
      setsLost: det.setsWonA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    }, rosterIds);
  } else {
    addAggScoped(agg, idA, labelA, {
      played: 1,
      losses: 1,
      setsWon: det.setsWonA,
      setsLost: det.setsWonB,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    }, rosterIds);
    addAggScoped(agg, idB, labelB, {
      played: 1,
      wins: 1,
      setsWon: det.setsWonB,
      setsLost: det.setsWonA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    }, rosterIds);
  }
}

function ingestWalkoverResultForGroup(
  r: MatchResult,
  nameToId: Map<string, RosterEntry>,
  agg: Map<string, Agg>,
  rosterIds?: Set<string>,
): boolean {
  const keyA = normName(r.playerA);
  const keyB = normName(r.playerB);
  const pA = nameToId.get(keyA);
  const pB = nameToId.get(keyB);
  if (!pA && !pB) return false;
  const winIsB = walkoverWinnerIsPlayerB(r.score);
  const winAgg = walkoverAggForWinner(winIsB);
  const lossAgg = walkoverAggForLoser();
  if (pA) {
    addAggScoped(
      agg,
      pA.id,
      pA.tournamentName,
      winIsB ? { played: 1, losses: 1, ...lossAgg } : { played: 1, wins: 1, ...winAgg },
      rosterIds,
    );
  }
  if (pB) {
    addAggScoped(
      agg,
      pB.id,
      pB.tournamentName,
      winIsB ? { played: 1, wins: 1, ...winAgg } : { played: 1, losses: 1, ...lossAgg },
      rosterIds,
    );
  }
  return true;
}

function ingestResultForGroup(
  r: MatchResult,
  nameToId: Map<string, RosterEntry>,
  agg: Map<string, Agg>,
  rosterIds?: Set<string>,
): void {
  const status = r.status;
  if (status === 'pending' || status === 'suspended') return;
  const scoreTrim = (r.score ?? '').trim();
  if (status === 'walkover' || (status === 'played' && /^[AB]$/i.test(scoreTrim))) {
    ingestWalkoverResultForGroup(r, nameToId, agg, rosterIds);
    return;
  }

  const keyA = normName(r.playerA);
  const keyB = normName(r.playerB);
  const pA = nameToId.get(keyA);
  const pB = nameToId.get(keyB);
  if (!pA && !pB) return;

  if (status === 'played' || status === 'retired') {
    const det = parseKoPlayedScoreDetail(r.score ?? '', status === 'retired');
    if (!det.ok) return;
    const winA = det.winner === 'A';
    if (pA) {
      addAggScoped(
        agg,
        pA.id,
        pA.tournamentName,
        {
          played: 1,
          wins: winA ? 1 : 0,
          losses: winA ? 0 : 1,
          setsWon: det.setsWonA,
          setsLost: det.setsWonB,
          gamesWon: det.gamesWonA,
          gamesLost: det.gamesWonB,
        },
        rosterIds,
      );
    }
    if (pB) {
      addAggScoped(
        agg,
        pB.id,
        pB.tournamentName,
        {
          played: 1,
          wins: winA ? 0 : 1,
          losses: winA ? 1 : 0,
          setsWon: det.setsWonB,
          setsLost: det.setsWonA,
          gamesWon: det.gamesWonB,
          gamesLost: det.gamesWonA,
        },
        rosterIds,
      );
    }
  }
}

export function sortPublicGroupStandingRows(rows: PublicGroupStandingRow[]): PublicGroupStandingRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.PG !== a.PG) return b.PG - a.PG;
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return a.playerName.localeCompare(b.playerName, 'es');
    })
    .map((r, i) => ({ ...r, position: i + 1 }));
}

function rowsFromAgg(agg: Map<string, Agg>, rosterById: Map<string, RosterEntry>): PublicGroupStandingRow[] {
  const list = [...rosterById.keys()].map((playerId) => {
    const row = agg.get(playerId);
    const meta = rosterById.get(playerId)!;
    return {
      position: 0,
      playerId,
      playerName: row?.playerName ?? meta.tournamentName,
      PJ: row?.played ?? 0,
      PG: row?.wins ?? 0,
      PP: row?.losses ?? 0,
      setsWon: row?.setsWon ?? 0,
      setsLost: row?.setsLost ?? 0,
      gamesWon: row?.gamesWon ?? 0,
      gamesLost: row?.gamesLost ?? 0,
      setDiff: (row?.setsWon ?? 0) - (row?.setsLost ?? 0),
    };
  });
  return sortPublicGroupStandingRows(list);
}

function consolidateAggToRoster(
  agg: Map<string, Agg>,
  rosterById: Map<string, RosterEntry>,
  idToCanonical: Map<string, string>,
): void {
  for (const [rawId, row] of [...agg.entries()]) {
    const canonicalId = idToCanonical.get(rawId) ?? rawId;
    if (!rosterById.has(canonicalId)) continue;
    if (canonicalId === rawId) continue;
    const meta = rosterById.get(canonicalId)!;
    addAgg(agg, canonicalId, meta.tournamentName, {
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      setsWon: row.setsWon,
      setsLost: row.setsLost,
      gamesWon: row.gamesWon,
      gamesLost: row.gamesLost,
    });
    agg.delete(rawId);
  }
}

function ligaDocGroupKeys(ligaDoc: unknown): string[] {
  if (!ligaDoc || typeof ligaDoc !== 'object') return [];
  const grupos = (ligaDoc as { grupos?: Record<string, unknown> }).grupos;
  if (!grupos || typeof grupos !== 'object') return [];
  return Object.keys(grupos);
}

export async function buildPublicGroupStandings(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<PublicGroupStandingsPayload | null> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: {
        orderBy: { key: 'asc' },
        include: {
          players: {
            orderBy: { seed: 'asc' },
            include: { player: { select: { id: true, name: true, displayName: true } } },
          },
        },
      },
    },
  });
  if (!t) return null;

  const docKeys = ligaDocGroupKeys(t.ligaDoc);
  const groupKeys = new Set<string>();
  for (const g of t.groups) groupKeys.add(g.key);
  for (const k of docKeys) groupKeys.add(k);
  if (groupKeys.size === 0) return { tournamentId: t.id, groups: [] };

  const [results, completedGroupMatches] = await Promise.all([
    prisma.matchResult.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ roundNum: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.match.findMany({
      where: { tournamentId: t.id, stage: 'group', completed: true },
      include: {
        group: { select: { key: true } },
        player1: { select: { id: true, name: true, displayName: true } },
        player2: { select: { id: true, name: true, displayName: true } },
        winner: { select: { id: true, name: true } },
      },
    }),
  ]);

  const resultMatchIds = new Set(
    results.map((r) => r.matchId?.trim()).filter((id): id is string => Boolean(id)),
  );
  const matchesByGroupKey = new Map<string, typeof completedGroupMatches>();
  for (const m of completedGroupMatches) {
    const gk = m.group?.key?.trim();
    if (!gk) continue;
    const list = matchesByGroupKey.get(gk) ?? [];
    list.push(m);
    matchesByGroupKey.set(gk, list);
  }

  const groups: PublicGroupStandingsGroup[] = [];

  for (const groupKey of [...groupKeys].sort((a, b) => {
    if (a.toLowerCase() === 'interzonal') return 1;
    if (b.toLowerCase() === 'interzonal') return -1;
    return a.localeCompare(b, 'es');
  })) {
    const dbGroup = t.groups.find((g) => g.key === groupKey);
    const dbPlayers: PlayerNameRef[] = (dbGroup?.players ?? []).map((gp) => ({
      id: gp.player.id,
      name: gp.player.name,
      displayName: gp.player.displayName,
    }));

    const docGrupos =
      t.ligaDoc && typeof t.ligaDoc === 'object'
        ? ((t.ligaDoc as { grupos?: Record<string, string[]> }).grupos ?? {})
        : {};
    const docNames = docGrupos[groupKey] ?? [];
    const docResolved: PlayerNameRef[] = [];
    for (const raw of docNames) {
      const name = String(raw).trim();
      if (!name) continue;
      let hit = await prisma.player.findFirst({
        where: {
          OR: [{ name }, { displayName: name }],
        },
        select: { id: true, name: true, displayName: true },
      });
      if (!hit) {
        hit =
          dbPlayers.find(
            (p) =>
              normName(p.name) === normName(name) ||
              (p.displayName?.trim() && normName(p.displayName) === normName(name)) ||
              fullNameMatchesShortTournamentName(p.displayName ?? p.name, name),
          ) ?? null;
      }
      if (hit) {
        docResolved.push(hit);
      } else {
        docResolved.push({ id: `name:${normName(name)}`, name, displayName: null });
      }
    }

    const { nameToId, rosterById, idToCanonical } = buildMergedGroupRosterWithMeta(
      dbPlayers,
      docNames,
      docResolved,
    );

    const agg = new Map<string, Agg>();
    for (const { id, tournamentName } of rosterById.values()) {
      agg.set(id, {
        playerId: id,
        playerName: tournamentName,
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      });
    }

    const rosterIds = new Set(rosterById.keys());
    const ingestedInGroup = new Set<string>();

    for (const r of results) {
      const gk = (r.groupKey ?? '').trim();
      if (isKnockoutGroupKey(gk)) continue;
      const dedupe = groupStatsDedupeKey(r);
      if (ingestedInGroup.has(dedupe)) continue;
      if (isNormalGroupLetterKey(gk)) {
        if (gk.toUpperCase() !== groupKey.toUpperCase()) continue;
        ingestResultForGroup(r, nameToId, agg, rosterIds);
        ingestedInGroup.add(dedupe);
        continue;
      }
      if (isInterzonalGroupKey(gk) && resultTouchesGroupRoster(r, nameToId)) {
        ingestResultForGroup(r, nameToId, agg, rosterIds);
        ingestedInGroup.add(dedupe);
      }
    }

    for (const m of matchesByGroupKey.get(groupKey) ?? []) {
      if (resultMatchIds.has(m.id)) continue;
      const dedupe = `match:${m.id}`;
      if (ingestedInGroup.has(dedupe)) continue;
      ingestMatchRowForGroup(m, nameToId, agg, rosterIds);
      ingestedInGroup.add(dedupe);
    }

    consolidateAggToRoster(agg, rosterById, idToCanonical);

    groups.push({
      key: groupKey,
      name: dbGroup?.displayName ?? formatGroupName(groupKey),
      rows: rowsFromAgg(agg, rosterById),
    });
  }

  return { tournamentId: t.id, groups };
}

export async function findTournamentBySlugOrId(prisma: PrismaClient, slugOrId: string) {
  return prisma.tournament.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    select: { id: true, slug: true },
  });
}
