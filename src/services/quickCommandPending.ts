/**
 * Pendientes para quick-command admin — lógica alineada al frontend (`assistantPendingQuery`).
 */
import type { MatchResult, PrismaClient, ScheduleStatus, TournamentScheduleEntry } from '@prisma/client';

export type QuickPendingStatusType =
  | 'scheduled_without_result'
  | 'unscheduled'
  | 'suspended'
  | 'postponed'
  | 'all';

export type QuickPendingPhase =
  | 'grupos'
  | 'repechaje'
  | 'octavos'
  | 'cuartos'
  | 'semis'
  | 'final';

export type QuickPendingCard = {
  dedupeKey: string;
  matchId?: string;
  tournamentId: string;
  headerLine: string;
  playersLine: string;
  scheduleLine: string;
  ballCarrierLine?: string;
  phaseId: QuickPendingPhase;
  kind: 'fixture' | 'ko';
  resultStatus?: string;
  scheduleStatus?: string;
};

const VALID_STATUS = new Set<string>([
  'scheduled_without_result',
  'unscheduled',
  'suspended',
  'postponed',
  'all',
]);

export function normalizeQuickPendingPhase(raw: string): QuickPendingPhase | null {
  const p = raw.trim().toLowerCase();
  if (p === 'group' || p === 'grupos') return 'grupos';
  if (p === 'repechaje') return 'repechaje';
  if (p === 'octavos') return 'octavos';
  if (p === 'quarter' || p === 'cuartos') return 'cuartos';
  if (p === 'semi' || p === 'semis') return 'semis';
  if (p === 'final') return 'final';
  return null;
}

export function parseQuickPendingStatusType(raw: string): QuickPendingStatusType | null {
  const v = raw.trim();
  return VALID_STATUS.has(v) ? (v as QuickPendingStatusType) : null;
}

function cleanPlayerName(raw: string): string {
  return raw.replace(/\s*\(P\)\s*$/i, '').replace(/^\s*\(P\)\s*/i, '').trim();
}

function normDedupePlayerName(raw: string): string {
  return cleanPlayerName(raw)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

function matchInputDedupeKey(m: {
  tournamentId: string;
  group: string;
  round: number;
  playerA: string;
  playerB: string;
}): string {
  const g = (m.group ?? '').trim();
  const r = m.round ?? 0;
  return `${m.tournamentId}|${r}|${g}|${normDedupePlayerName(m.playerA)}|${normDedupePlayerName(m.playerB)}`;
}

function parseVsLine(line: string): { rawLeft: string; rawRight: string; a: string; b: string } | null {
  const trimmed = line.trim();
  if (!/\s+vs\s+/i.test(trimmed)) return null;
  const parts = trimmed.split(/\s+vs\s+/i);
  if (parts.length < 2) return null;
  const rawLeft = parts[0]!.trim();
  const rawRight = parts.slice(1).join(' vs ').trim();
  const a = cleanPlayerName(rawLeft);
  const b = cleanPlayerName(rawRight);
  if (!a || !b) return null;
  return { rawLeft, rawRight, a, b };
}

type FixtureRow = {
  dedupeKey: string;
  tournamentId: string;
  round: number;
  group: string;
  playerA: string;
  playerB: string;
  rawLine?: string;
};

function pushFixtureFromLigaDoc(tournamentId: string, ligaDoc: unknown, out: FixtureRow[]): void {
  if (!ligaDoc || typeof ligaDoc !== 'object') return;
  const doc = ligaDoc as { fechas?: unknown[] };
  if (!Array.isArray(doc.fechas)) return;
  for (const fechaRaw of doc.fechas) {
    if (!fechaRaw || typeof fechaRaw !== 'object') continue;
    const fecha = fechaRaw as { numero?: number; grupos?: Record<string, string[]>; partidos?: string[] };
    const round = typeof fecha.numero === 'number' ? fecha.numero : 0;
    if (fecha.grupos && typeof fecha.grupos === 'object') {
      for (const [gk, lines] of Object.entries(fecha.grupos)) {
        if (!Array.isArray(lines)) continue;
        for (const line of lines) {
          if (typeof line !== 'string') continue;
          if (/^Libre:/i.test(line.trim())) continue;
          const vs = parseVsLine(line);
          if (!vs) continue;
          out.push({
            dedupeKey: matchInputDedupeKey({ tournamentId, group: gk, round, playerA: vs.a, playerB: vs.b }),
            tournamentId,
            round,
            group: gk,
            playerA: vs.a,
            playerB: vs.b,
            rawLine: line,
          });
        }
      }
    }
    if (Array.isArray(fecha.partidos)) {
      for (const line of fecha.partidos) {
        if (typeof line !== 'string') continue;
        const vs = parseVsLine(line);
        if (!vs) continue;
        out.push({
          dedupeKey: matchInputDedupeKey({
            tournamentId,
            group: 'Interzonal',
            round,
            playerA: vs.a,
            playerB: vs.b,
          }),
          tournamentId,
          round,
          group: 'Interzonal',
          playerA: vs.a,
          playerB: vs.b,
          rawLine: line,
        });
      }
    }
  }
}

function classifyKoStage(roundLabel: string): QuickPendingPhase | null {
  const lower = roundLabel.trim().toLowerCase();
  if (/repechaje|repesca|play-?off|play-?in|previo|clasificatorio/i.test(lower)) return 'repechaje';
  if (/\boctavos?\b|round\s*(of\s*)?16|\br16\b/i.test(lower)) return 'octavos';
  if (/cuarto|quarter|\bqf\b/i.test(lower)) return 'cuartos';
  if (/semi/i.test(lower)) return 'semis';
  if (/\bfinal\b/i.test(lower)) return 'final';
  return null;
}

function isPendingResult(row: MatchResult | undefined): boolean {
  if (!row) return true;
  if (row.status === 'suspended') return false;
  if (row.status === 'walkover' || row.status === 'retired') return false;
  if (row.status === 'played' && !!row.score?.trim()) return false;
  return true;
}

function hasScheduledDateTime(sched?: TournamentScheduleEntry | undefined): boolean {
  return !!(sched?.date?.trim() && sched?.time?.trim());
}

function scheduleDisplayLine(sched?: TournamentScheduleEntry): string {
  if (!sched) return 'Sin fecha ni hora';
  if (sched.scheduleStatus === 'postponed') return 'Postergado';
  if (sched.scheduleStatus === 'suspended') return 'Suspendido';
  if (!hasScheduledDateTime(sched)) return 'Sin fecha ni hora';
  const date = sched.date!.trim();
  const time = sched.time!.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date);
  const datePart = Number.isFinite(d.getTime())
    ? d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    : date;
  return time ? `${datePart} · ${time}` : datePart;
}

function ballCarrier(rawLine?: string, playerA?: string, playerB?: string): string | undefined {
  if (rawLine) {
    const vs = parseVsLine(rawLine);
    if (vs) {
      if (/\(P\)/i.test(vs.rawLeft)) return cleanPlayerName(vs.rawLeft);
      if (/\(P\)/i.test(vs.rawRight)) return cleanPlayerName(vs.rawRight);
    }
  }
  if (playerA && /\(P\)/i.test(playerA)) return cleanPlayerName(playerA);
  if (playerB && /\(P\)/i.test(playerB)) return cleanPlayerName(playerB);
  return undefined;
}

type Enriched = {
  dedupeKey: string;
  matchId?: string;
  tournamentId: string;
  headerLine: string;
  playersLine: string;
  phaseId: QuickPendingPhase;
  kind: 'fixture' | 'ko';
  stored?: MatchResult;
  schedule?: TournamentScheduleEntry;
  rawLine?: string;
  playerA: string;
  playerB: string;
};

function matchesStatusType(item: Enriched, statusType: QuickPendingStatusType): boolean {
  const stored = item.stored;
  const schedule = item.schedule;
  const pendingResult = isPendingResult(stored);
  const scheduled = hasScheduledDateTime(schedule);
  const cancelled = schedule?.scheduleStatus === 'cancelled';

  switch (statusType) {
    case 'scheduled_without_result':
      return (
        pendingResult &&
        scheduled &&
        !cancelled &&
        schedule?.scheduleStatus !== 'postponed' &&
        schedule?.scheduleStatus !== 'suspended' &&
        stored?.status !== 'suspended'
      );
    case 'unscheduled':
      return pendingResult && !scheduled && !cancelled && stored?.status !== 'suspended' && schedule?.scheduleStatus !== 'postponed';
    case 'suspended':
      return stored?.status === 'suspended' || schedule?.scheduleStatus === 'suspended';
    case 'postponed':
      return schedule?.scheduleStatus === 'postponed';
    case 'all':
      return (
        matchesStatusType(item, 'scheduled_without_result') ||
        matchesStatusType(item, 'unscheduled') ||
        matchesStatusType(item, 'suspended') ||
        matchesStatusType(item, 'postponed')
      );
    default:
      return false;
  }
}

function toCard(item: Enriched): QuickPendingCard {
  const ball = ballCarrier(item.rawLine, item.playerA, item.playerB);
  return {
    dedupeKey: item.dedupeKey,
    matchId: item.matchId ?? undefined,
    tournamentId: item.tournamentId,
    headerLine: item.headerLine,
    playersLine: item.playersLine,
    scheduleLine: scheduleDisplayLine(item.schedule),
    ballCarrierLine: ball ? `Pelotas: ${ball}` : undefined,
    phaseId: item.phaseId,
    kind: item.kind,
    resultStatus: item.stored?.status,
    scheduleStatus: item.schedule?.scheduleStatus,
  };
}

export async function queryQuickCommandPending(
  prisma: PrismaClient,
  args: {
    tournamentId: string;
    league?: number;
    phase: QuickPendingPhase;
    statusType: QuickPendingStatusType;
  },
): Promise<{ items: QuickPendingCard[]; statusType: QuickPendingStatusType; total: number }> {
  const tournamentId = args.tournamentId.trim();
  const tour = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tour) {
    return { items: [], statusType: args.statusType, total: 0 };
  }

  const [results, schedules, matches] = await Promise.all([
    prisma.matchResult.findMany({ where: { tournamentId } }),
    prisma.tournamentScheduleEntry.findMany({ where: { tournamentId } }),
    prisma.match.findMany({
      where: { tournamentId },
      include: { player1: true, player2: true },
    }),
  ]);

  const resultByKey = new Map(results.map((r) => [r.dedupeKey, r]));
  const scheduleByKey = new Map(schedules.map((s) => [s.dedupeKey, s]));
  const enriched: Enriched[] = [];
  const seen = new Set<string>();

  const fixtureRows: FixtureRow[] = [];
  pushFixtureFromLigaDoc(tournamentId, tour.ligaDoc, fixtureRows);

  for (const row of fixtureRows) {
    if (args.phase !== 'grupos') continue;
    const stored = resultByKey.get(row.dedupeKey);
    if (!isPendingResult(stored) && stored?.status !== 'suspended') continue;
    if (seen.has(row.dedupeKey)) continue;
    seen.add(row.dedupeKey);
    const grupoLabel = row.group === 'Interzonal' ? 'Interzonal' : `Grupo ${row.group}`;
    enriched.push({
      dedupeKey: row.dedupeKey,
      matchId: stored?.matchId ?? undefined,
      tournamentId,
      headerLine: `${grupoLabel} · Fecha ${row.round}`,
      playersLine: `${row.playerA} vs ${row.playerB}`,
      phaseId: 'grupos',
      kind: 'fixture',
      stored,
      schedule: scheduleByKey.get(row.dedupeKey),
      rawLine: row.rawLine,
      playerA: row.playerA,
      playerB: row.playerB,
    });
  }

  for (const m of matches) {
    const roundLabel = m.roundLabel ?? '';
    const koPhase = classifyKoStage(roundLabel);
    if (!koPhase || koPhase !== args.phase) continue;
    const playerA = cleanPlayerName(m.player1.displayName ?? m.player1.name);
    const playerB = cleanPlayerName(m.player2.displayName ?? m.player2.name);
    const dedupeKey = m.id;
    const stored = resultByKey.get(dedupeKey) ?? [...resultByKey.values()].find((r) => r.matchId === m.id);
    if (!isPendingResult(stored) && stored?.status !== 'suspended') continue;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    enriched.push({
      dedupeKey,
      matchId: m.id,
      tournamentId,
      headerLine: roundLabel.trim() || koPhase,
      playersLine: `${playerA} vs ${playerB}`,
      phaseId: koPhase,
      kind: 'ko',
      stored,
      schedule: scheduleByKey.get(dedupeKey),
      playerA,
      playerB,
    });
  }

  for (const sched of schedules) {
    if (sched.scheduleStatus !== 'postponed' && sched.scheduleStatus !== 'suspended') continue;
    if (seen.has(sched.dedupeKey)) continue;
    const stored = resultByKey.get(sched.dedupeKey);
    const fixture = fixtureRows.find((f) => f.dedupeKey === sched.dedupeKey);
    if (fixture && args.phase === 'grupos') {
      seen.add(sched.dedupeKey);
      const grupoLabel = fixture.group === 'Interzonal' ? 'Interzonal' : `Grupo ${fixture.group}`;
      enriched.push({
        dedupeKey: fixture.dedupeKey,
        matchId: stored?.matchId ?? undefined,
        tournamentId,
        headerLine: `${grupoLabel} · Fecha ${fixture.round}`,
        playersLine: `${fixture.playerA} vs ${fixture.playerB}`,
        phaseId: 'grupos',
        kind: 'fixture',
        stored,
        schedule: sched,
        rawLine: fixture.rawLine,
        playerA: fixture.playerA,
        playerB: fixture.playerB,
      });
    }
  }

  void args.league;

  const items = enriched.filter((e) => matchesStatusType(e, args.statusType)).map(toCard);
  return { items, statusType: args.statusType, total: items.length };
}

export function mapScheduleStatus(raw: ScheduleStatus): string {
  return raw;
}
