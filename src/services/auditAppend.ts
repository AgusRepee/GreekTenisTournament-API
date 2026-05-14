import type { Prisma, PrismaClient } from '@prisma/client';

type AuditClient = Pick<PrismaClient, 'auditLog'>;

export async function appendAudit(
  prisma: AuditClient,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    tournamentId?: string | null;
    league?: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
    createdBy?: string | null;
    payload?: unknown;
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entityType,
      entityId: entry.entityId ?? undefined,
      tournamentId: entry.tournamentId ?? undefined,
      league: entry.league ?? undefined,
      beforeJson: toInputJson(entry.beforeJson),
      afterJson: toInputJson(entry.afterJson),
      createdBy: entry.createdBy ?? undefined,
      payload: toInputJson(entry.payload),
    },
  });
}

function toInputJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  return v as Prisma.InputJsonValue;
}
