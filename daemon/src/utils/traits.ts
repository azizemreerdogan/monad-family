import { AgentTraits, JobType } from '../types';

export const JOB_TYPES = { TRADER: 0, FARMER: 1, LENDER: 2 } as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function jitter(seed: number, offset: number): number {
  // Extract a byte at the given offset and map to -10..+10
  const byte = (seed >> (offset * 8)) & 0xff;
  return (byte % 21) - 10;
}

function avg(x: number, y: number): number {
  return Math.floor((x + y) / 2);
}

export function blendTraits(
  parentA: { riskScore: number; patience: number; socialScore: number; jobType: JobType; balance: bigint },
  parentB: { riskScore: number; patience: number; socialScore: number; jobType: JobType; balance: bigint },
  seed: number,
): AgentTraits {
  const riskScore = clamp(avg(parentA.riskScore, parentB.riskScore) + jitter(seed, 0));
  const patience = clamp(avg(parentA.patience, parentB.patience) + jitter(seed, 1));
  const socialScore = clamp(avg(parentA.socialScore, parentB.socialScore) + jitter(seed, 2));

  // Dominant parent = higher balance
  const dominantParent = parentA.balance >= parentB.balance ? parentA : parentB;

  // 30% mutation chance — pick a random job that is NOT the dominant parent's job
  const mutate = ((seed >> 24) & 0xff) < 77; // 77/255 ≈ 30%
  let jobType: JobType;

  if (mutate) {
    const otherJobs = ([0, 1, 2] as JobType[]).filter((j) => j !== dominantParent.jobType);
    jobType = otherJobs[(seed >> 16) % otherJobs.length];
  } else {
    jobType = dominantParent.jobType;
  }

  return { riskScore, patience, socialScore, jobType };
}
