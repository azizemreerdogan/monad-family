import { describe, it, expect } from 'vitest';
import { blendTraits } from '../src/utils/traits';
import { JobType } from '../src/types';

const parentA = {
  riskScore: 50,
  patience: 60,
  socialScore: 70,
  jobType: 0 as JobType, // Trader
  balance: 100n,
};

const parentB = {
  riskScore: 30,
  patience: 80,
  socialScore: 50,
  jobType: 1 as JobType, // Farmer
  balance: 80n,
};

describe('blendTraits', () => {
  it('produces averages close to parent midpoints', () => {
    const traits = blendTraits(parentA, parentB, 0x00000000);
    // avg(50,30)=40, avg(60,80)=70, avg(70,50)=60
    expect(traits.riskScore).toBeGreaterThanOrEqual(30);
    expect(traits.riskScore).toBeLessThanOrEqual(50);
    expect(traits.patience).toBeGreaterThanOrEqual(60);
    expect(traits.patience).toBeLessThanOrEqual(80);
    expect(traits.socialScore).toBeGreaterThanOrEqual(50);
    expect(traits.socialScore).toBeLessThanOrEqual(70);
  });

  it('clamps riskScore to 0 when jitter pushes below 0', () => {
    // parentA riskScore=0, parentB riskScore=0, seed jitter=-10
    const pA = { ...parentA, riskScore: 0 };
    const pB = { ...parentB, riskScore: 0 };
    const traits = blendTraits(pA, pB, 0x00000000);
    expect(traits.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps riskScore to 100 when jitter pushes above 100', () => {
    const pA = { ...parentA, riskScore: 100 };
    const pB = { ...parentB, riskScore: 100 };
    const traits = blendTraits(pA, pB, 0xffffffff);
    expect(traits.riskScore).toBeLessThanOrEqual(100);
  });

  it('dominant parent (higher balance) determines base jobType when no mutation', () => {
    // seed byte 3 = 0x00 → 0/255 < 30% so mutation
    // use a seed where byte 3 >= 77 (no mutation)
    // byte3 = 0x80 = 128 >= 77 → no mutation
    const seed = 0x80000000;
    const traits = blendTraits(parentA, parentB, seed);
    // parentA has higher balance (100n > 80n) → dominant is Trader (0)
    if (!((seed >> 24 & 0xff) < 77)) {
      expect(traits.jobType).toBe(parentA.jobType);
    }
  });

  it('returns a valid jobType (0, 1, or 2) always', () => {
    for (let seed = 0; seed < 100; seed++) {
      const traits = blendTraits(parentA, parentB, seed * 0x01010101);
      expect([0, 1, 2]).toContain(traits.jobType);
    }
  });

  it('all output traits are numbers', () => {
    const traits = blendTraits(parentA, parentB, 0xdeadbeef);
    expect(typeof traits.riskScore).toBe('number');
    expect(typeof traits.patience).toBe('number');
    expect(typeof traits.socialScore).toBe('number');
    expect(typeof traits.jobType).toBe('number');
  });
});
