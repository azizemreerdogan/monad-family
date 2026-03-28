import { describe, it, expect } from 'vitest';
import { parseWorkResponse } from '../src/claude/parser';

describe('parseWorkResponse', () => {
  it('detects swap action', () => {
    const result = parseWorkResponse('I swap half my balance into a high-yield token.');
    expect(result.action).toBe('swap');
  });

  it('detects stake action', () => {
    const result = parseWorkResponse('I stake my MON in a stable yield pool.');
    expect(result.action).toBe('stake');
  });

  it('detects lend action', () => {
    const result = parseWorkResponse('I lend 20% of my balance to a trusted agent.');
    expect(result.action).toBe('lend');
  });

  it('detects farm as stake', () => {
    const result = parseWorkResponse('I farm a new liquidity pool for maximum yield.');
    expect(result.action).toBe('stake');
  });

  it('returns unknown for unrecognized text', () => {
    const result = parseWorkResponse('I hold and observe the market conditions.');
    expect(result.action).toBe('unknown');
  });

  it('preserves the original summary text', () => {
    const text = 'I stake my MON carefully.';
    const result = parseWorkResponse(text);
    expect(result.summary).toBe(text);
  });

  it('trims whitespace from summary', () => {
    const result = parseWorkResponse('  I stake my MON.  ');
    expect(result.summary).toBe('I stake my MON.');
  });
});
