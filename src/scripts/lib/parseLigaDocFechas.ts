/**
 * Convierte `fechas` de un ligaDoc JSON en fixtures sin resultados (admin carga después).
 */

export type ParsedFixture = {
  group: string;
  round: number;
  playerA: string;
  playerB: string;
  ballPlayer: string;
};

export type LigaDocJson = {
  torneo?: string;
  liga?: number;
  grupos?: Record<string, string[]>;
  fechas?: Array<{
    numero: number;
    tipo?: string;
    grupos?: Record<string, string[]>;
    partidos?: string[];
  }>;
  nota?: string;
  inconsistenciasPendientes?: string[];
};

const INTERZONAL_LABEL = (n: number) => `Fecha ${n} (Interzonal)`;

/** Parsea "Nombre A. (P) vs Nombre B." */
export function parseVsLine(line: string): { playerA: string; playerB: string; ballPlayer: string } | null {
  const raw = line.trim();
  if (!raw || /^Libre:/i.test(raw)) return null;
  const parts = raw.split(/\s+vs\s+/i);
  if (parts.length !== 2) return null;

  let left = parts[0]!.trim();
  let right = parts[1]!.trim();
  let ballPlayer = '';

  if (/\(P\)/i.test(left)) {
    left = left.replace(/\s*\(P\)\s*/gi, '').trim();
    ballPlayer = left;
  }
  if (/\(P\)/i.test(right)) {
    right = right.replace(/\s*\(P\)\s*/gi, '').trim();
    ballPlayer = right;
  }
  if (!ballPlayer) ballPlayer = left;
  if (!left || !right) return null;

  return { playerA: left, playerB: right, ballPlayer };
}

export function fixturesFromLigaDoc(doc: LigaDocJson): ParsedFixture[] {
  const out: ParsedFixture[] = [];
  const fechas = Array.isArray(doc.fechas) ? doc.fechas : [];

  for (const fecha of fechas) {
    const round = Number(fecha.numero);
    if (!Number.isFinite(round)) continue;

    if (fecha.tipo === 'interzonal' && Array.isArray(fecha.partidos)) {
      const group = INTERZONAL_LABEL(round);
      for (const line of fecha.partidos) {
        const parsed = parseVsLine(line);
        if (parsed) out.push({ group, round, ...parsed });
      }
      continue;
    }

    const grupos = fecha.grupos ?? {};
    for (const [groupKey, lines] of Object.entries(grupos)) {
      if (!Array.isArray(lines)) continue;
      for (const line of lines) {
        const parsed = parseVsLine(line);
        if (parsed) out.push({ group: groupKey, round, ...parsed });
      }
    }
  }

  return out;
}
