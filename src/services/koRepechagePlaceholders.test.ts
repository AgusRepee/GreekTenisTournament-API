import { describe, expect, it } from 'vitest';
import {
  repechageIndexFromMatchId,
  repechageWaitPlayerId,
  repechageWaitTokenFromPlayerId,
  resolveBracketSlotPlayerId,
} from './koRepechagePlaceholders.js';

describe('koRepechagePlaceholders', () => {
  it('mapea WAIT_RP_n a sys-ko-wait-rp-n', () => {
    expect(resolveBracketSlotPlayerId('WAIT_RP_0')).toBe('sys-ko-wait-rp-0');
    expect(resolveBracketSlotPlayerId('WAIT_RP_2')).toBe('sys-ko-wait-rp-2');
    expect(resolveBracketSlotPlayerId('p-real')).toBe('p-real');
  });

  it('infiere índice desde id de partido repechaje', () => {
    expect(repechageIndexFromMatchId('ko-t-novak-l4-rp-0', 't-novak-l4')).toBe(0);
    expect(repechageIndexFromMatchId('ko-t-novak-l4-qf-0', 't-novak-l4')).toBeNull();
  });

  it('convierte playerId sistema a token UI', () => {
    expect(repechageWaitPlayerId(1)).toBe('sys-ko-wait-rp-1');
    expect(repechageWaitTokenFromPlayerId('sys-ko-wait-rp-1')).toBe('WAIT_RP_1');
  });
});
