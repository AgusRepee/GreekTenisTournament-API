import { prisma } from '../lib/prisma.js';

const PUBLIC_META_BASE = {
  id: true,
  slug: true,
  name: true,
  preclasificacionJson: true,
} as const;

const PUBLIC_META_FULL = {
  ...PUBLIC_META_BASE,
  groupRosterOverrideJson: true,
} as const;

function isMissingGroupRosterFieldError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('groupRosterOverrideJson');
}

/** Metadatos públicos por id; tolera client Prisma desactualizado en algún worker. */
export async function findTournamentPublicMetaById(id: string) {
  try {
    return await prisma.tournament.findUnique({
      where: { id },
      select: PUBLIC_META_FULL,
    });
  } catch (err) {
    if (!isMissingGroupRosterFieldError(err)) throw err;
    const row = await prisma.tournament.findUnique({
      where: { id },
      select: PUBLIC_META_BASE,
    });
    return row ? { ...row, groupRosterOverrideJson: null } : null;
  }
}

const ADMIN_META_BASE = {
  id: true,
  slug: true,
  name: true,
  tournamentType: true,
  status: true,
  startDate: true,
  endDate: true,
  location: true,
  coverImage: true,
  slotsTotal: true,
  slotsTaken: true,
  ligaDoc: true,
  preclasificacionJson: true,
  winnerId: true,
  finalistId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ADMIN_META_FULL = {
  ...ADMIN_META_BASE,
  groupRosterOverrideJson: true,
} as const;

/** Metadatos admin por id; mismo fallback que la ruta pública. */
export async function findTournamentAdminMetaById(id: string) {
  try {
    return await prisma.tournament.findUnique({
      where: { id },
      select: ADMIN_META_FULL,
    });
  } catch (err) {
    if (!isMissingGroupRosterFieldError(err)) throw err;
    const row = await prisma.tournament.findUnique({
      where: { id },
      select: ADMIN_META_BASE,
    });
    return row ? { ...row, groupRosterOverrideJson: null } : null;
  }
}
