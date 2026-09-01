import { describe, expect, it } from 'vitest';
import { isInterzonalGroupKey } from './interzonalGroupKey.js';

describe('isInterzonalGroupKey', () => {
  it('acepta Interzonal y Fecha N (Interzonal)', () => {
    expect(isInterzonalGroupKey('Interzonal')).toBe(true);
    expect(isInterzonalGroupKey('Fecha 4 (Interzonal)')).toBe(true);
    expect(isInterzonalGroupKey('B')).toBe(false);
  });
});
