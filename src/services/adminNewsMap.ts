import type { NewsStatus } from '@prisma/client';

export type AdminNewsStatus = 'draft' | 'active' | 'inactive';
export type AdminNewsTopic = 'Torneo' | 'Club' | 'Ranking' | 'General';

export const MAX_PINNED_NEWS = 3;

const TOPICS = new Set<string>(['Torneo', 'Club', 'Ranking', 'General']);

export function adminStatusToDb(status: string | undefined): NewsStatus {
  if (status === 'active') return 'published';
  if (status === 'inactive') return 'archived';
  return 'draft';
}

export function dbStatusToAdmin(status: NewsStatus): AdminNewsStatus {
  if (status === 'published') return 'active';
  if (status === 'archived') return 'inactive';
  return 'draft';
}

export function normalizeNewsTopic(raw: unknown): AdminNewsTopic {
  const t = typeof raw === 'string' ? raw.trim() : '';
  return TOPICS.has(t) ? (t as AdminNewsTopic) : 'General';
}

export function excerptFromBody(body: string): string {
  const t = body.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length <= 200 ? t : `${t.slice(0, 197)}…`;
}

export function parseNewsDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = raw.trim().slice(0, 10);
  const dt = new Date(`${d}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function pinnedAtToIso(row: { pinnedAt: Date | null }): string | undefined {
  return row.pinnedAt ? row.pinnedAt.toISOString() : undefined;
}

export function mapAdminNewsRow(row: {
  id: string;
  title: string;
  body: string | null;
  topic: string;
  image: string | null;
  status: NewsStatus;
  publishedAt: Date | null;
  createdAt: Date;
  pinnedAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    content: row.body ?? '',
    topic: row.topic,
    image: row.image ?? undefined,
    date: (row.publishedAt ?? row.createdAt).toISOString().slice(0, 10),
    status: dbStatusToAdmin(row.status),
    createdAt: row.createdAt.toISOString(),
    pinnedAt: pinnedAtToIso(row),
  };
}

export function mapPublicNewsRow(row: {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  image: string | null;
  topic: string;
  publishedAt: Date | null;
  createdAt: Date;
  pinnedAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? '',
    body: row.body ?? '',
    image: row.image ?? undefined,
    topic: row.topic,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString().slice(0, 10),
    pinnedAt: pinnedAtToIso(row),
  };
}
