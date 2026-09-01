import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { fixturesFromLigaDoc, type LigaDocJson, type ParsedFixture } from './parseLigaDocFechas.js';
import { NOVAK_ND2026_START } from '../../services/novakTournamentDates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATEGORY_BY_LEAGUE = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta A', 'Sexta'] as const;

export type Nd2026TournamentSeedConfig = {
  tournamentId: string;
  leagueNum: number;
  slug: string;
  name: string;
  coverImage: string;
  location?: string;
  jsonFile: string;
  matchIdPrefix: string;
  playerIdPrefix: string;
};

function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function categoryForLeague(leagueNum: number): string {
  const idx = leagueNum - 1;
  return CATEGORY_BY_LEAGUE[idx] ?? 'Tercera';
}

function stageForGroup(group: string): MatchStage {
  if (group === 'Cuartos de Final') return 'quarterfinal';
  if (group === 'Semifinales') return 'semifinal';
  if (group === 'Final') return 'final';
  if (group === 'Repechaje') return 'repechage';
  if (group.includes('Interzonal')) return 'interzonal';
  return 'group';
}

function roundLabel(row: ParsedFixture): string {
  if (row.group === 'A' || row.group === 'B' || row.group === 'C') {
    return `Grupo ${row.group} - Fecha ${row.round}`;
  }
  if (row.group.includes('Interzonal')) return 'Interzonal';
  return row.group;
}

function loadLigaDoc(jsonFile: string): LigaDocJson {
  const path = join(__dirname, '..', 'data', jsonFile);
  return JSON.parse(readFileSync(path, 'utf8')) as LigaDocJson;
}

export async function runNd2026TournamentSeed(config: Nd2026TournamentSeedConfig): Promise<number> {
  const doc = loadLigaDoc(config.jsonFile);
  const fixtures = fixturesFromLigaDoc(doc);
  const groups = doc.grupos ?? {};
  const category = categoryForLeague(config.leagueNum);

  const playerIdCache = new Map<string, string>();

  async function resolvePlayerId(name: string): Promise<string> {
    const key = normName(name);
    const cached = playerIdCache.get(key);
    if (cached) return cached;

    const all = await prisma.player.findMany({
      select: { id: true, name: true, displayName: true },
    });
    const hit = all.find((p) => normName(p.name) === key || normName(p.displayName ?? '') === key);
    const fallback = `${config.playerIdPrefix}-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    const id = hit?.id ?? fallback;
    if (!hit) {
      await prisma.player.upsert({
        where: { id },
        create: {
          id,
          name,
          displayName: name,
          category,
          nationality: 'Argentina',
          rosterActive: true,
          profileVisibility: 'active',
        },
        update: { name, displayName: name, category, rosterActive: true, profileVisibility: 'active' },
      });
    }
    playerIdCache.set(key, id);
    return id;
  }

  const allNames = Array.from(new Set([...Object.values(groups).flat(), ...fixtures.flatMap((f) => [f.playerA, f.playerB])]));
  for (const name of allNames) {
    await resolvePlayerId(name);
  }

  const playerId = (name: string) => playerIdCache.get(normName(name))!;

  function dedupeKey(m: ParsedFixture): string {
    return `${config.tournamentId}|${m.round}|${m.group}|${normName(m.playerA)}|${normName(m.playerB)}`;
  }

  function matchId(index: number): string {
    return `${config.matchIdPrefix}-${String(index + 1).padStart(2, '0')}`;
  }

  const ligaDocJson = (): Prisma.InputJsonValue => doc as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx) => {
    await tx.matchResult.deleteMany({ where: { tournamentId: config.tournamentId } });
    await tx.tournamentScheduleEntry.deleteMany({ where: { tournamentId: config.tournamentId } });
    await tx.match.deleteMany({ where: { tournamentId: config.tournamentId } });

    await tx.tournament.upsert({
      where: { id: config.tournamentId },
      create: {
        id: config.tournamentId,
        slug: config.slug,
        name: config.name,
        tournamentType: 'greek500',
        status: 'upcoming',
        startDate: NOVAK_ND2026_START,
        endDate: NOVAK_ND2026_START,
        location: config.location ?? 'Club de Tenis',
        coverImage: config.coverImage,
        slotsTotal: allNames.length,
        slotsTaken: allNames.length,
        ligaDoc: ligaDocJson(),
      },
      update: {
        slug: config.slug,
        name: config.name,
        tournamentType: 'greek500',
        status: 'upcoming',
        location: config.location ?? 'Club de Tenis',
        coverImage: config.coverImage,
        slotsTotal: allNames.length,
        slotsTaken: allNames.length,
        ligaDoc: ligaDocJson(),
      },
    });

    const league = await tx.tournamentLeague.upsert({
      where: { tournamentId_leagueNum: { tournamentId: config.tournamentId, leagueNum: config.leagueNum } },
      create: {
        tournamentId: config.tournamentId,
        leagueNum: config.leagueNum,
        groupStageStatus: 'open',
      },
      update: { groupStageStatus: 'open' },
    });

    const groupIds = new Map<string, string>();
    for (const [key, names] of Object.entries(groups)) {
      const group = await tx.group.upsert({
        where: { tournamentId_key: { tournamentId: config.tournamentId, key } },
        create: { tournamentId: config.tournamentId, key, displayName: `Grupo ${key}` },
        update: { displayName: `Grupo ${key}` },
      });
      groupIds.set(key, group.id);
      for (const [index, name] of names.entries()) {
        const pid = playerId(name);
        await tx.groupPlayer.upsert({
          where: { groupId_playerId: { groupId: group.id, playerId: pid } },
          create: { groupId: group.id, playerId: pid, seed: index + 1 },
          update: { seed: index + 1 },
        });
      }
    }

    for (const [index, row] of fixtures.entries()) {
      const id = matchId(index);
      const p1 = playerId(row.playerA);
      const p2 = playerId(row.playerB);
      const note = `Jugador con pelotas: ${row.ballPlayer}.`;
      const groupId = groupIds.get(row.group) ?? null;

      await tx.match.create({
        data: {
          id,
          tournamentId: config.tournamentId,
          tournamentLeagueId: league.id,
          groupId,
          stage: stageForGroup(row.group),
          roundLabel: roundLabel(row),
          player1Id: p1,
          player2Id: p2,
          winnerId: null,
          loserId: null,
          score: '',
          scheduleStatus: 'unscheduled',
          scheduledDate: null,
          scheduledTime: null,
          completed: false,
        },
      });

      await tx.tournamentScheduleEntry.create({
        data: {
          dedupeKey: dedupeKey(row),
          tournamentId: config.tournamentId,
          leagueNum: config.leagueNum,
          scheduleStatus: 'unscheduled',
          date: null,
          time: null,
          note,
        },
      });
    }
  });

  return fixtures.length;
}
