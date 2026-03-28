import { describe, it, expect } from 'vitest';
import { buildWorkPrompt, buildPersonalityPrompt } from '../src/claude/prompts';
import { Agent, JobType } from '../src/types';
import { ethers } from 'ethers';

const mockAgent: Agent = {
  id: 1n,
  name: 'Aria',
  jobType: 1 as JobType, // Farmer
  riskScore: 25,
  patience: 85,
  socialScore: 70,
  age: 12n,
  balance: ethers.parseEther('7.5'),
  partnerId: 0n,
  childIds: [],
  retired: false,
  personalityCID: 'mock-cid-1',
};

describe('buildWorkPrompt', () => {
  it('includes age in correct format', () => {
    const prompt = buildWorkPrompt(mockAgent);
    expect(prompt).toContain('12/100');
  });

  it('includes balance as formatted MON', () => {
    const prompt = buildWorkPrompt(mockAgent);
    expect(prompt).toContain('7.500 MON');
  });

  it('includes job name', () => {
    const prompt = buildWorkPrompt(mockAgent);
    expect(prompt).toContain('Farmer');
  });

  it('ends with reply instruction', () => {
    const prompt = buildWorkPrompt(mockAgent);
    expect(prompt).toContain('Reply in one sentence');
  });
});

describe('buildPersonalityPrompt', () => {
  const parentAText = 'You are Aria, a cautious Farmer.';
  const parentBText = 'You are Kaan, an aggressive Trader.';
  const childTraits = { riskScore: 55, patience: 50, socialScore: 60, jobType: 0 };

  it('includes both parent texts', () => {
    const prompt = buildPersonalityPrompt(parentAText, parentBText, childTraits);
    expect(prompt).toContain(parentAText);
    expect(prompt).toContain(parentBText);
  });

  it('includes child trait values', () => {
    const prompt = buildPersonalityPrompt(parentAText, parentBText, childTraits);
    expect(prompt).toContain('55/100');
    expect(prompt).toContain('50/100');
    expect(prompt).toContain('60/100');
  });

  it('includes the child job name', () => {
    const prompt = buildPersonalityPrompt(parentAText, parentBText, childTraits);
    expect(prompt).toContain('Trader');
  });
});
