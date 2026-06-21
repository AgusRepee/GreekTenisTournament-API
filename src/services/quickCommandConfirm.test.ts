import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {},
}));

import { handleQuickCommandConfirm } from './quickCommandConfirm.js';

describe('handleQuickCommandConfirm', () => {
  it('rechaza acción desconocida', async () => {
    const result = await handleQuickCommandConfirm({ action: 'unknown' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('valida campos obligatorios de schedule_match', async () => {
    const result = await handleQuickCommandConfirm({
      action: 'schedule_match',
      dedupeKey: '',
      tournamentId: 't1',
      league: 3,
      date: '2026-03-22',
      time: '20:00',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('valida league en suspend_match', async () => {
    const result = await handleQuickCommandConfirm({
      action: 'suspend_match',
      dedupeKey: 'k1',
      tournamentId: 't1',
      playerA: 'A',
      playerB: 'B',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
