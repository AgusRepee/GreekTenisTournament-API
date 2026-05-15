import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { buildPublicPlayerProfile } from '../services/buildPublicPlayerProfile.js';
import { comparePublicRankingRows, type RankingRowWithPlayer } from '../services/rankingPublicSort.js';

export const publicRouter = Router();

publicRouter.get('/home', async (_req, res, next) => {
  try {
    const [tournamentsResult, playersResult] = await Promise.allSettled([
      prisma.tournament.findMany({
        where: { status: 'upcoming' },
        orderBy: { startDate: 'asc' },
        take: 6,
        select: { id: true, slug: true, name: true, startDate: true, endDate: true, coverImage: true, tournamentType: true },
      }),
      prisma.player.findMany({ take: 8, orderBy: { name: 'asc' }, select: { id: true, name: true, category: true } }),
    ]);
    if (tournamentsResult.status === 'rejected') console.error('[public/home] tournaments query failed', tournamentsResult.reason);
    if (playersResult.status === 'rejected') console.error('[public/home] players query failed', playersResult.reason);
    res.json({
      tournaments: tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : [],
      playersPreview: playersResult.status === 'fulfilled' ? playersResult.value : [],
      message: 'Agregá agregación real (partidos, noticias) en fase 6–7',
    });
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/tournaments', async (_req, res, next) => {
  try {
    const rows = await prisma.tournament.findMany({
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        coverImage: true,
        tournamentType: true,
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Metadatos mínimos por id (p. ej. seeds/preclasificación para bracket público). Debe ir antes de `/tournaments/:slug`. */
publicRouter.get('/tournaments/by-id/:id', async (req, res, next) => {
  try {
    const row = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        name: true,
        preclasificacionJson: true,
      },
    });
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

async function buildTournamentSchedulePayload(tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, slug: true, status: true, startDate: true, endDate: true },
  });
  if (!t) return null;
  const [matches, schedules] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      include: {
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
      },
    }),
    prisma.tournamentScheduleEntry.findMany({
      where: { tournamentId: t.id },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  return { tournament: t, matches, schedules };
}

/** Agenda pública por `tournamentId` (el SPA suele tener el id aunque el slug solo exista en MySQL). */
publicRouter.get('/schedule', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    if (!tid) {
      res.status(400).json({ error: 'tournamentId query required' });
      return;
    }
    const payload = await buildTournamentSchedulePayload(tid);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

/** Partidos + agenda (`Match` + `TournamentScheduleEntry`) para el torneo público. */
publicRouter.get('/tournaments/:slug/schedule', async (req, res, next) => {
  try {
    const t = await prisma.tournament.findFirst({
      where: { slug: req.params.slug },
      select: { id: true, name: true, slug: true, status: true, startDate: true, endDate: true },
    });
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const payload = await buildTournamentSchedulePayload(t.id);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

async function buildPublicEliminationPayload(tournamentId: string, leagueNum: number) {
  const league = await prisma.tournamentLeague.findFirst({
    where: { tournamentId, leagueNum },
    include: { elimination: true },
  });
  if (!league) return null;
  const st = league.eliminationStatus ?? '';
  const matches =
    st === 'confirmed' || st === 'in_progress' || st === 'finished'
      ? await prisma.match.findMany({
          where: { tournamentId, tournamentLeagueId: league.id },
          orderBy: [{ roundLabel: 'asc' }, { id: 'asc' }],
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
            winner: { select: { id: true, name: true } },
            loser: { select: { id: true, name: true } },
          },
        })
      : [];
  return { league, bracket: league.elimination, matches };
}

/** Eliminación pública por `tournamentId` + número de liga (default 1). */
publicRouter.get('/elimination', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    const leagueNum = Math.min(6, Math.max(1, Math.floor(Number(req.query.leagueNum)) || 1));
    if (!tid) {
      res.status(400).json({ error: 'tournamentId query required' });
      return;
    }
    const payload = await buildPublicEliminationPayload(tid, leagueNum);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

/** Cuadro KO público (solo partidos persistidos si la eliminación está confirmada o en curso). */
publicRouter.get('/tournaments/:slug/elimination', async (req, res, next) => {
  try {
    const t = await prisma.tournament.findFirst({
      where: { slug: req.params.slug },
      select: { id: true, name: true, slug: true },
    });
    if (!t) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const leagueNum = Math.min(6, Math.max(1, Math.floor(Number(req.query.leagueNum)) || 1));
    const payload = await buildPublicEliminationPayload(t.id, leagueNum);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ tournament: t, ...payload });
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/tournaments/:slug', async (req, res, next) => {
  try {
    const row = await prisma.tournament.findFirst({
      where: { slug: req.params.slug },
      include: { groups: true, leagues: true },
    });
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/rankings', async (req, res, next) => {
  try {
    const leagueRaw = req.query.league;
    const n = leagueRaw != null && String(leagueRaw).trim() !== '' ? Number(leagueRaw) : NaN;
    const leagueNum = Number.isFinite(n) && n >= 1 && n <= 6 ? Math.floor(n) : null;

    const baseWhere =
      leagueNum != null && leagueNum >= 1 && leagueNum <= 6 ? { league: leagueNum } : {};

    const rows = await prisma.leagueRankingRow.findMany({
      where: baseWhere,
      include: { player: { select: { id: true, name: true, category: true, profileImage: true } } },
      take: 2000,
    });

    const typed = rows as RankingRowWithPlayer[];
    const snapshots = await prisma.rankingSnapshot.findMany({
      orderBy: { computedAt: 'desc' },
      take: 5,
    });

    const rankRows = (list: RankingRowWithPlayer[]) =>
      [...list].sort(comparePublicRankingRows).map((r, i) => ({ ...r, rank: i + 1 }));

    if (leagueNum != null) {
      const withRank = rankRows(typed);
      res.json({
        rows: withRank,
        leagueFilter: leagueNum,
        snapshots,
        leagueRows: withRank,
      });
      return;
    }

    const byLeague: Record<string, ReturnType<typeof rankRows>> = {};
    for (let L = 1; L <= 6; L++) {
      byLeague[String(L)] = rankRows(typed.filter((r) => r.league === L));
    }

    res.json({
      byLeague,
      snapshots,
      /** Lista plana (todas las ligas), útil para clientes legacy */
      leagueRows: typed.sort(comparePublicRankingRows),
    });
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/players/:id', async (req, res, next) => {
  try {
    const payload = await buildPublicPlayerProfile(prisma, req.params.id);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});
