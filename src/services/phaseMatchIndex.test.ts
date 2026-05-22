import type { Player } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import { buildNameToId, normName } from './phaseMatchIndex.js';

describe('normName', () => {
  it('ignora diferencias de tilde al comparar', () => {
    expect(normName('Monzón M.')).toBe(normName('Monzon M.'));
    expect(normName('Ríos J.')).toBe(normName('Rios J.'));
  });
});

describe('buildNameToId', () => {
  it('resuelve el mismo id para variantes con y sin tilde', () => {
    const players = [{ id: 'p-1', name: 'Monzon M.', displayName: null, category: 'Segunda' }] as unknown as Player[];
    const m = buildNameToId(players);
    expect(m.get(normName('Monzón M.'))).toBe('p-1');
    expect(m.get(normName('Monzon M.'))).toBe('p-1');
  });
});
