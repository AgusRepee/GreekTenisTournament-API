import type { Match, MatchResult, PrismaClient } from '@prisma/client';
import { parseKoPlayedScoreDetail } from './koScoreParse.js';
import { normName } from './phaseMatchIndex.js';

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

function ingestMatchRowForGroup(
  m: Match & {
    player1: { id: string; name: string; displayName: string | null };
    player2: { id: string; name: string; displayName: string | null };
    winner: { id: string; name: string } | null;
  },
  nameToId: Map<string, { id: string; name: string }>,
  agg: Map<string, Agg>,
): void {
  if (!m.winnerId || !m.player1Id || !m.player2Id) return;
  const pA = {
    id: m.player1Id,
    name: m.player1.displayName ?? m.player1.name,
  };
  const pB = {
    id: m.player2Id,
    name: m.player2.displayName ?? m.player2.name,
  };
  nameToId.set(normName(pA.name), pA);
  nameToId.set(normName(pB.name), pB);

  const score = (m.score ?? '').trim();
  const wo = /^[AB]$/i.test(score) || /\bW\.?O\.?\b/i.test(score);
  if (wo) {
    const winIsB = m.winnerId === pB.id;
    addAgg(agg, pA.id, pA.name, winIsB ? { played: 1, losses: 1 } : { played: 1, wins: 1 });
    addAgg(agg, pB.id, pB.name, winIsB ? { played: 1, wins: 1 } : { played: 1, losses: 1 });
    return;
  }

  const winA = m.winnerId === pA.id;
  const det = parseKoPlayedScoreDetail(score, /\bRET\.?\b/i.test(score));
  if (!det.ok) {
    addAgg(agg, pA.id, pA.name, { played: 1, wins: winA ? 1 : 0, losses: winA ? 0 : 1 });
    addAgg(agg, pB.id, pB.name, { played: 1, wins: winA ? 0 : 1, losses: winA ? 1 : 0 });
    return;
  }
  if (winA) {
    addAgg(agg, pA.id, pA.name, {
      played: 1,
      wins: 1,
      setsWon: det.setsWonA,
      setsLost: det.setsWonB,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    });
    addAgg(agg, pB.id, pB.name, {
      played: 1,
      losses: 1,
      setsWon: det.setsWonB,
      setsLost: det.setsWonA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    });
  } else {
    addAgg(agg, pA.id, pA.name, {
      played: 1,
      losses: 1,
      setsWon: det.setsWonA,
      setsLost: det.setsWonB,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    });
    addAgg(agg, pB.id, pB.name, {
      played: 1,
      wins: 1,
      setsWon: det.setsWonB,
      setsLost: det.setsWonA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    });
  }
}

function ingestResultForGroup(
  r: MatchResult,
  nameToId: Map<string, { id: string; name: string }>,
  agg: Map<string, Agg>,
): void {
  const status = r.status;
  if (status === 'pending' || status === 'suspended') return;
  const keyA = normName(r.playerA);
  const keyB = normName(r.playerB);
  const pA = nameToId.get(keyA);
  const pB = nameToId.get(keyB);
  if (!pA || !pB) return;

  if (status === 'walkover') {
    const s = (r.score ?? '').trim().toUpperCase();
    const winIsB = s === 'B';
    addAgg(agg, pA.id, pA.name, winIsB ? { played: 1, losses: 1 } : { played: 1, wins: 1 });
    addAgg(agg, pB.id, pB.name, winIsB ? { played: 1, wins: 1 } : { played: 1, losses: 1 });
    return;
  }

  if (status === 'played' || status === 'retired') {
    const det = parseKoPlayedScoreDetail(r.score ?? '', status === 'retired');
    if (!det.ok) return;
    const winA = det.winner === 'A';
    addAgg(agg, pA.id, pA.name, {
      played: 1,
      wins: winA ? 1 : 0,
      losses: winA ? 0 : 1,
      setsWon: det.setsWonA,
      setsLost: det.setsWonB,
      gamesWon: det.gamesWonA,
      gamesLost: det.gamesWonB,
    });
    addAgg(agg, pB.id, pB.name, {
      played: 1,
      wins: winA ? 0 : 1,
      losses: winA ? 1 : 0,
      setsWon: det.setsWonB,
      setsLost: det.setsWonA,
      gamesWon: det.gamesWonB,
      gamesLost: det.gamesWonA,
    });
  }
}

function sortRows(rows: PublicGroupStandingRow[]): PublicGroupStandingRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.PG !== a.PG) return b.PG - a.PG;
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return a.playerName.localeCompare(b.playerName, 'es');
    })
    .map((r, i) => ({ ...r, position: i + 1 }));
}

function rowsFromAgg(agg: Map<string, Agg>): PublicGroupStandingRow[] {
  const list = [...agg.values()].map((r) => ({
    position: 0,
    playerId: r.playerId,
    playerName: r.playerName,
    PJ: r.played,
    PG: r.wins,
    PP: r.losses,
    setsWon: r.setsWon,
    setsLost: r.setsLost,
    gamesWon: r.gamesWon,
    gamesLost: r.gamesLost,
    setDiff: r.setsWon - r.setsLost,
  }));
  return sortRows(list);
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
    const nameToId = new Map<string, { id: string; name: string }>();
    for (const gp of dbGroup?.players ?? []) {
      const name = (gp.player.displayName ?? gp.player.name).trim();
      nameToId.set(normName(name), { id: gp.player.id, name });
    }

    const docGrupos =
      t.ligaDoc && typeof t.ligaDoc === 'object'
        ? ((t.ligaDoc as { grupos?: Record<string, string[]> }).grupos ?? {})
        : {};
    const docNames = docGrupos[groupKey] ?? [];
    for (const raw of docNames) {
      const name = String(raw).trim();
      if (!name) continue;
      const nk = normName(name);
      if (!nameToId.has(nk)) {
        const hit = await prisma.player.findFirst({
          where: {
            OR: [{ name }, { displayName: name }],
          },
          select: { id: true, name: true, displayName: true },
        });
        if (hit) {
          nameToId.set(nk, { id: hit.id, name: hit.displayName ?? hit.name });
        } else {
          nameToId.set(nk, { id: `name:${nk}`, name });
        }
      }
    }

    const agg = new Map<string, Agg>();
    for (const { id, name } of nameToId.values()) {
      agg.set(id, {
        playerId: id,
        playerName: name,
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      });
    }

    for (const r of results) {
      if ((r.groupKey ?? '').trim() !== groupKey) continue;
      ingestResultForGroup(r, nameToId, agg);
    }

    for (const m of matchesByGroupKey.get(groupKey) ?? []) {
      if (resultMatchIds.has(m.id)) continue;
      ingestMatchRowForGroup(m, nameToId, agg);
    }

    groups.push({
      key: groupKey,
      name: dbGroup?.displayName ?? formatGroupName(groupKey),
      rows: rowsFromAgg(agg),
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
