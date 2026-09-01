/** Etiquetas legibles de fase/grupo para la sección «Últimos partidos» del perfil. */

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

function knockoutFromSegmentPath(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  if (/(^|[-_/\.])rp($|[-_/\.])|repechaje|repesca|play-?off|play-?in|previo|clasificatorio|precuadro/.test(lower)) {
    return 'Repechaje';
  }
  if (/(^|[-_/\.])r16($|[-_/\.])|octavos|8vos|roundof16|of16|16avos|eighth/.test(lower)) {
    return 'Octavos de final';
  }
  if (/(^|[-_/\.])qf($|[-_/\.])|cuartos|quarter/.test(lower)) return 'Cuartos de final';
  if (/(^|[-_/\.])sf($|[-_/\.])|semifinal/.test(lower)) return 'Semifinal';
  if (
    /(^|[-_/\.])fn($|[-_/\.])|(^|[-_/\.])final($|[-_/\.])|kofinal/.test(lower) &&
    !/semi|quarter|octavos|repechaje/.test(lower)
  ) {
    return 'Final';
  }
  if (/group.?ko|groupko/.test(lower)) return 'Eliminatorias';
  return null;
}

export function knockoutStageFromToken(token: string): string | null {
  const fromPath = knockoutFromSegmentPath(token);
  if (fromPath) return fromPath;

  const t = normalizeToken(token);
  if (!t) return null;
  if (/repechaje|repesca|playoff|playin|previo|clasificatorio|precuadro|^rp$/.test(t)) return 'Repechaje';
  if (/octavos|8vos|roundof16|r16|of16|16avos|eighth/.test(t)) return 'Octavos de final';
  if (/cuartos|quarter|^qf$|koqf/.test(t)) return 'Cuartos de final';
  if (/semifinal|^sf$|kosf/.test(t)) return 'Semifinal';
  if (/^final$|^fn$|kofinal|kofn/.test(t)) return 'Final';
  if (t.includes('final') && !t.includes('semifinal') && !t.includes('quarter') && !t.includes('octavos')) {
    return 'Final';
  }
  return null;
}

export function knockoutStageFromRoundLabel(roundLabel: string | null | undefined): string | null {
  const raw = (roundLabel ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/^fecha\s*\d/i.test(raw)) return null;
  if (/repechaje|repesca|play-?off|play-?in|previo|clasificatorio|pre-?cuadro/i.test(lower)) return 'Repechaje';
  if (/\boctavos?\b|dieciseis|round\s*(of\s*)?16|\br16\b|\bof\s*16\b|16avos?|8vos?|\beighth\b/i.test(lower)) {
    return 'Octavos de final';
  }
  if (/cuarto|quarter|\bqf\b/i.test(lower)) return 'Cuartos de final';
  if (/semi/i.test(lower)) return 'Semifinal';
  if (/\bfinal\b/i.test(lower) || lower === 'final') return 'Final';
  return null;
}

export function knockoutStageFromMatchStage(stage: string | null | undefined): string | null {
  const s = (stage ?? '').trim().toLowerCase();
  if (s === 'repechage') return 'Repechaje';
  if (s === 'quarterfinal') return 'Cuartos de final';
  if (s === 'semifinal') return 'Semifinal';
  if (s === 'final') return 'Final';
  if (s === 'group' || s === 'interzonal' || s === 'other') return null;
  return knockoutStageFromToken(s);
}

export function groupPhaseFromGroupKey(groupKey: string | null | undefined): string | null {
  const g = (groupKey ?? '').trim();
  if (!g) return 'Fase de grupos';
  if (/^interzonal$/i.test(g)) return 'Interzonal';
  if (/^[A-Z]$/i.test(g)) return `Grupo ${g.toUpperCase()}`;
  if (/^grupo\s+[A-Z]$/i.test(g)) return g.replace(/^grupo/i, 'Grupo');
  if (/^KO-/i.test(g) || /^group[-_]?ko$/i.test(g) || /ko[-_](sf|qf|fn|final|r16|rp)/i.test(g)) return null;
  return null;
}

export function resolveKnockoutPhaseLabel(args: {
  groupKey?: string | null;
  matchId?: string | null;
  matchStage?: string | null;
  roundLabel?: string | null;
}): string | null {
  const fromRound = knockoutStageFromRoundLabel(args.roundLabel);
  if (fromRound) return fromRound;

  const fromStage = knockoutStageFromMatchStage(args.matchStage);
  if (fromStage) return fromStage;

  const g = (args.groupKey ?? '').trim();
  if (/^KO-/i.test(g)) {
    const idPart = g.slice(3);
    const fromId = knockoutStageFromToken(idPart) ?? knockoutStageFromToken(g);
    if (fromId) return fromId;
  } else if (g) {
    const fromKey = knockoutStageFromToken(g);
    if (fromKey) return fromKey;
  }

  const mid = (args.matchId ?? '').trim();
  if (mid) {
    const fromMid = knockoutStageFromToken(mid);
    if (fromMid) return fromMid;
  }

  if (/^KO-/i.test(g)) return 'Eliminatorias';
  return null;
}

/** Evita «Novak Djokovic - Liga 1 · Liga 1 · …» cuando el nombre del torneo ya incluye la liga. */
export function stripRedundantLeagueFromTournamentName(
  tournamentName: string,
  leagueNum: number | null,
): string {
  let name = tournamentName.trim() || 'Torneo';
  if (leagueNum == null || leagueNum < 1 || leagueNum > 6) return name;
  const suffix = new RegExp(`(?:\\s*[-–—·|]\\s*|\\s+)Liga\\s*${leagueNum}\\s*$`, 'i');
  const stripped = name.replace(suffix, '').trim();
  return stripped || name;
}

export function buildProfileMatchPhaseLabel(args: {
  tournamentName: string;
  leagueNum: number | null;
  groupKey?: string | null;
  matchId?: string | null;
  matchStage?: string | null;
  roundLabel?: string | null;
}): string {
  const tName = stripRedundantLeagueFromTournamentName(args.tournamentName, args.leagueNum);
  const leaguePart = args.leagueNum != null && args.leagueNum >= 1 && args.leagueNum <= 6 ? `Liga ${args.leagueNum}` : null;

  const ko = resolveKnockoutPhaseLabel(args);
  const phasePart = ko ?? groupPhaseFromGroupKey(args.groupKey) ?? 'Partido';

  return [tName, leaguePart, phasePart].filter(Boolean).join(' · ');
}

export function parseScheduleDateIso(date: string | null | undefined): string | undefined {
  const raw = (date ?? '').trim();
  if (!raw) return undefined;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString().slice(0, 10);
}
