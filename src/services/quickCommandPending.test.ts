import { describe, expect, it } from 'vitest';
import { normalizeQuickPendingPhase, parseQuickPendingStatusType } from './quickCommandPending.js';

describe('quickCommandPending parsers', () => {
  it('normaliza fase group y grupos', () => {
    expect(normalizeQuickPendingPhase('group')).toBe('grupos');
    expect(normalizeQuickPendingPhase('grupos')).toBe('grupos');
    expect(normalizeQuickPendingPhase('quarter')).toBe('cuartos');
  });

  it('valida statusType', () => {
    expect(parseQuickPendingStatusType('scheduled_without_result')).toBe('scheduled_without_result');
    expect(parseQuickPendingStatusType('invalid')).toBeNull();
  });
});
