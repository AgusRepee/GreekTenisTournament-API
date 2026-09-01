import { describe, it, expect } from 'vitest';
import { normalizeWalkoverScoreLetter, walkoverWinnerIsPlayerB } from './walkoverWinnerSide.js';

describe('walkoverWinnerSide', () => {
  it('score B → gana playerB', () => {
    expect(walkoverWinnerIsPlayerB('B')).toBe(true);
    expect(normalizeWalkoverScoreLetter('B')).toBe('B');
  });

  it('score A → gana playerA', () => {
    expect(walkoverWinnerIsPlayerB('A')).toBe(false);
    expect(normalizeWalkoverScoreLetter('A')).toBe('A');
  });

  it('legacy 0-6 0-6 → gana playerB', () => {
    expect(walkoverWinnerIsPlayerB('0-6 0-6')).toBe(true);
    expect(normalizeWalkoverScoreLetter('0-6 0-6')).toBe('B');
  });

  it('legacy 6-0 6-0 → gana playerA', () => {
    expect(walkoverWinnerIsPlayerB('6-0 6-0')).toBe(false);
    expect(normalizeWalkoverScoreLetter('6-0 6-0')).toBe('A');
  });
});
