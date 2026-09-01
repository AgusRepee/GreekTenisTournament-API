import { normName } from './phaseMatchIndex.js';

export type PlayerNameRef = {
  id: string;
  name: string;
  displayName: string | null;
};

export type RosterEntry = {
  id: string;
  tournamentName: string;
};

/** Formato corto de torneo: Apellido I. (campo `name`, no `displayName`). */
export function tournamentShortName(p: { name: string; displayName?: string | null }): string {
  const short = String(p.name ?? '').trim();
  if (short) return short;
  return String(p.displayName ?? '').trim() || 'Jugador';
}

export function parseShortTournamentName(name: string): { last: string; initial: string } | null {
  const m = /^(.+?)\s+([A-Za-zÀ-ÿ])\.?\s*$/.exec(String(name ?? '').trim());
  if (!m) return null;
  return { last: normName(m[1]!), initial: m[2]!.toLowerCase() };
}

/** Ej.: "Javier Repecka" ↔ "Repecka J." */
export function fullNameMatchesShortTournamentName(fullName: string, shortName: string): boolean {
  const parsed = parseShortTournamentName(shortName);
  if (!parsed) return false;
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  const last = normName(parts[parts.length - 1]!);
  const firstInitial = parts[0]![0]?.toLowerCase();
  if (!firstInitial) return false;
  return last === parsed.last && firstInitial === parsed.initial;
}

export function playersAreSamePerson(a: PlayerNameRef, b: PlayerNameRef): boolean {
  if (a.id === b.id) return true;
  const keysA = new Set<string>();
  if (a.name.trim()) keysA.add(normName(a.name));
  if (a.displayName?.trim()) keysA.add(normName(a.displayName));
  const keysB: string[] = [];
  if (b.name.trim()) keysB.push(normName(b.name));
  if (b.displayName?.trim()) keysB.push(normName(b.displayName));
  if (keysB.some((k) => keysA.has(k))) return true;

  const aShort = tournamentShortName(a);
  const bShort = tournamentShortName(b);
  const aFull = a.displayName?.trim() || a.name.trim();
  const bFull = b.displayName?.trim() || b.name.trim();
  if (fullNameMatchesShortTournamentName(aFull, bShort)) return true;
  if (fullNameMatchesShortTournamentName(bFull, aShort)) return true;
  if (fullNameMatchesShortTournamentName(aFull, b.name)) return true;
  if (fullNameMatchesShortTournamentName(bFull, a.name)) return true;
  return false;
}

function chooseCanonicalPlayer(players: PlayerNameRef[], docNames: string[]): PlayerNameRef {
  for (const doc of docNames) {
    const nk = normName(doc);
    for (const p of players) {
      if (normName(tournamentShortName(p)) !== nk && normName(p.name) !== nk) continue;
      if (!p.id.startsWith('name:')) return p;
    }
  }
  for (const doc of docNames) {
    const nk = normName(doc);
    for (const p of players) {
      if (normName(tournamentShortName(p)) === nk || normName(p.name) === nk) return p;
    }
  }

  const real = players.filter((p) => !p.id.startsWith('name:'));
  const withShort = (real.length > 0 ? real : players).find((p) =>
    /\.[A-Za-zÀ-ÿ]\.?\s*$/.test(tournamentShortName(p)),
  );
  return withShort ?? real[0] ?? players[0]!;
}

function pickTournamentNameForCluster(players: PlayerNameRef[], docNames: string[]): string {
  for (const doc of docNames) {
    const docRef: PlayerNameRef = { id: '', name: doc, displayName: null };
    if (players.some((p) => playersAreSamePerson(p, docRef))) {
      return doc.trim();
    }
  }
  return tournamentShortName(chooseCanonicalPlayer(players, docNames));
}

function buildClusters(
  dbPlayers: PlayerNameRef[],
  docNames: string[],
  docResolved: PlayerNameRef[],
): PlayerNameRef[][] {
  const docPlayers: PlayerNameRef[] = docNames.map((doc) => {
    const hit = docResolved.find((p) => normName(p.name) === normName(doc));
    return hit ?? { id: `name:${normName(doc)}`, name: doc, displayName: null };
  });

  const clusters: PlayerNameRef[][] = docPlayers.map((p) => [p]);

  for (const dbp of dbPlayers) {
    let merged = false;
    for (const cluster of clusters) {
      if (cluster.some((q) => playersAreSamePerson(q, dbp))) {
        cluster.push(dbp);
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push([dbp]);
  }

  return clusters;
}

export function lookupRosterEntry(
  p: PlayerNameRef,
  nameToId: Map<string, RosterEntry>,
): RosterEntry | undefined {
  const keys = [normName(p.name), p.displayName?.trim() ? normName(p.displayName.trim()) : ''].filter(Boolean);
  for (const key of keys) {
    const hit = nameToId.get(key);
    if (hit) return hit;
  }
  return undefined;
}

export function buildMergedGroupRoster(
  dbPlayers: PlayerNameRef[],
  docNames: string[],
  docResolved: PlayerNameRef[],
): Map<string, RosterEntry> {
  return buildMergedGroupRosterWithMeta(dbPlayers, docNames, docResolved).nameToId;
}

export function buildMergedGroupRosterWithMeta(
  dbPlayers: PlayerNameRef[],
  docNames: string[],
  docResolved: PlayerNameRef[],
): {
  nameToId: Map<string, RosterEntry>;
  rosterById: Map<string, RosterEntry>;
  idToCanonical: Map<string, string>;
} {
  const clusters = buildClusters(dbPlayers, docNames, docResolved);
  const nameToId = new Map<string, RosterEntry>();
  const idToCanonical = new Map<string, string>();

  for (const cluster of clusters) {
    const canonical = chooseCanonicalPlayer(cluster, docNames);
    const tournamentName = pickTournamentNameForCluster(cluster, docNames);
    const entry: RosterEntry = { id: canonical.id, tournamentName };
    const aliasKeys = new Set<string>();

    for (const p of cluster) {
      idToCanonical.set(p.id, canonical.id);
      if (p.name.trim()) aliasKeys.add(normName(p.name));
      if (p.displayName?.trim()) aliasKeys.add(normName(p.displayName.trim()));
    }
    for (const doc of docNames) {
      const docRef: PlayerNameRef = { id: '', name: doc, displayName: null };
      if (cluster.some((p) => playersAreSamePerson(p, docRef))) {
        aliasKeys.add(normName(doc));
      }
    }
    for (const key of aliasKeys) {
      nameToId.set(key, entry);
    }
  }

  return { nameToId, rosterById: uniqueRosterEntries(nameToId), idToCanonical };
}

export function uniqueRosterEntries(nameToId: Map<string, RosterEntry>): Map<string, RosterEntry> {
  const byId = new Map<string, RosterEntry>();
  for (const entry of nameToId.values()) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return byId;
}
