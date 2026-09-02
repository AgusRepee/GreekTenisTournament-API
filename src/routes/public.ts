import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { withQueryTimeout } from '../lib/queryTimeout.js';
import { findTournamentPublicMetaById } from '../services/tournamentMetaQuery.js';
import { findTournamentBySlugOrId } from '../services/buildPublicGroupStandings.js';
import { pickBestMatchScore } from '../services/pickBestMatchScore.js';
import {
  fetchPublicGroupStandings,
  fetchPublicPlayerProfile,
  fetchPublicPlayersCatalog,
  fetchPublicRankingsCatalog,
  fetchPublicTournamentDetail,
  fetchPublicTournamentsCatalog,
} from '../services/publicCatalogQueries.js';

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
    res.json(await fetchPublicTournamentsCatalog());
  } catch (e) {
    next(e);
  }
});

/** Metadatos mínimos por id (p. ej. seeds/preclasificación para bracket público). Debe ir antes de `/tournaments/:slug`. */
publicRouter.get('/tournaments/by-id/:id', async (req, res, next) => {
  try {
    const row = await findTournamentPublicMetaById(req.params.id);
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
  const [matches, schedules, matchResults] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      include: {
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        group: { select: { key: true } },
      },
    }),
    prisma.tournamentScheduleEntry.findMany({
      where: { tournamentId: t.id },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.matchResult.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ roundNum: 'asc' }, { updatedAt: 'desc' }],
    }),
  ]);
  return { tournament: t, matches, schedules, matchResults };
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

/** Agenda pública completa o filtrada, sin JWT. */
publicRouter.get('/schedules', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    const rows = await withQueryTimeout(
      prisma.tournamentScheduleEntry.findMany({
        where: tid ? { tournamentId: tid } : undefined,
        orderBy: [{ date: 'asc' }, { time: 'asc' }, { updatedAt: 'desc' }],
        take: 1000,
      }),
      'public.schedules',
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Partidos + agenda (`Match` + `TournamentScheduleEntry`) para el torneo público. */
publicRouter.get('/tournaments/:slug/schedule', async (req, res, next) => {
  try {
    const t = await prisma.tournament.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
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
  const eliminationPublic =
    st === 'confirmed' || st === 'in_progress' || st === 'finished';
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
  const matchIds = matches.map((m) => m.id);
  const resultRows =
    matchIds.length > 0
      ? await prisma.matchResult.findMany({
          where: {
            matchId: { in: matchIds },
            status: { in: ['played', 'retired', 'walkover'] },
          },
          select: { matchId: true, score: true },
        })
      : [];
  const resultScoreByMatchId = new Map(
    resultRows.filter((r) => r.matchId).map((r) => [r.matchId!, r.score ?? '']),
  );
  const enrichedMatches = matches.map((m) => ({
    ...m,
    score: pickBestMatchScore(m.score, resultScoreByMatchId.get(m.id)),
  }));
  return {
    league,
    bracket: eliminationPublic ? league.elimination : null,
    matches: enrichedMatches,
  };
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

/** Tabla de grupos calculada desde `MatchResult` + partidos de grupo completados en `Match`. */
publicRouter.get('/tournaments/:slug/group-standings', async (req, res, next) => {
  try {
    const hit = await findTournamentBySlugOrId(prisma, req.params.slug);
    if (!hit) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const payload = await fetchPublicGroupStandings(hit.id);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

/** Misma tabla por `tournamentId` (el SPA suele tener el id aunque el slug solo exista en MySQL). */
publicRouter.get('/group-standings', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    if (!tid) {
      res.status(400).json({ error: 'tournamentId query required' });
      return;
    }
    const payload = await fetchPublicGroupStandings(tid);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

/** Resultados públicos (`MatchResult`) sin JWT: hidrata pantallas públicas en modo API. */
publicRouter.get('/match-results', async (req, res, next) => {
  try {
    const tid = typeof req.query.tournamentId === 'string' ? req.query.tournamentId.trim() : '';
    const rows = await withQueryTimeout(
      prisma.matchResult.findMany({
        where: tid ? { tournamentId: tid } : undefined,
        orderBy: [{ tournamentId: 'asc' }, { roundNum: 'asc' }, { updatedAt: 'desc' }],
        take: 1000,
        include: {
          match: {
            select: {
              id: true,
              tournamentId: true,
              group: { select: { id: true, key: true, displayName: true } },
              player1: { select: { id: true, name: true, displayName: true } },
              player2: { select: { id: true, name: true, displayName: true } },
              winner: { select: { id: true, name: true, displayName: true } },
            },
          },
        },
      }),
      'public.matchResults',
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Cuadro KO público (solo partidos persistidos si la eliminación está confirmada o en curso). */
publicRouter.get('/tournaments/:slug/elimination', async (req, res, next) => {
  try {
    const t = await prisma.tournament.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
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
    const payload = await fetchPublicTournamentDetail(req.params.slug);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/rankings', async (req, res, next) => {
  try {
    const leagueRaw = req.query.league ?? req.query.leagueNum;
    const n = leagueRaw != null && String(leagueRaw).trim() !== '' ? Number(leagueRaw) : NaN;
    const leagueNum = Number.isFinite(n) && n >= 1 && n <= 6 ? Math.floor(n) : null;
    res.json(await fetchPublicRankingsCatalog(leagueNum));
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/players', async (_req, res, next) => {
  try {
    res.json(await fetchPublicPlayersCatalog());
  } catch (e) {
    next(e);
  }
});

publicRouter.get('/players/:id', async (req, res, next) => {
  try {
    const payload = await fetchPublicPlayerProfile(req.params.id);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});
