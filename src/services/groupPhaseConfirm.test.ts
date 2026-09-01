import { describe, expect, it } from 'vitest';
import { isPendingGroupResult } from './groupPhaseConfirm.js';

describe('isPendingGroupResult', () => {
  it('bloquea solo pendientes de grupos, no partidos KO', () => {
    expect(isPendingGroupResult('A')).toBe(true);
    expect(isPendingGroupResult('Interzonal')).toBe(true);
    expect(isPendingGroupResult('KO-quarter')).toBe(false);
    expect(isPendingGroupResult(null)).toBe(false);
  });
});
