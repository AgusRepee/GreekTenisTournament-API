import { describe, expect, it } from 'vitest';
import { sanitizeMatchResultMatchIdCandidate } from './resolveMatchResultMatchId.js';

describe('sanitizeMatchResultMatchIdCandidate', () => {
  const dedupe = 't-rafa-nadal|5|B|repecka a.|mayer d.';

  it('descarta dedupeKey enviada como matchId', () => {
    expect(sanitizeMatchResultMatchIdCandidate(dedupe, dedupe)).toBeUndefined();
  });

  it('descarta claves con pipe (formato dedupe)', () => {
    expect(sanitizeMatchResultMatchIdCandidate('t-novak|1|A|a|b', dedupe)).toBeUndefined();
  });

  it('conserva id de partido KO del catálogo', () => {
    expect(sanitizeMatchResultMatchIdCandidate('ko-t-rafa-nadal-sf-0', dedupe)).toBe('ko-t-rafa-nadal-sf-0');
  });

  it('descarta vacío', () => {
    expect(sanitizeMatchResultMatchIdCandidate('', dedupe)).toBeUndefined();
    expect(sanitizeMatchResultMatchIdCandidate(undefined, dedupe)).toBeUndefined();
  });
});
