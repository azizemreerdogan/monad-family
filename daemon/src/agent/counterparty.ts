import { getAgentNFT, getFamilyRegistry } from '../contracts';
import { getWallet } from './wallets';
import { logger } from '../utils/logger';
import { Agent, CounterpartySelection } from '../types';

export async function selectCounterparty(
  agentId: number,
  allAgentIds: number[]
): Promise<CounterpartySelection> {
  const wallet = getWallet(agentId);
  const agentNFT = getAgentNFT(wallet) as unknown as { getAgent: (id: bigint) => Promise<Agent> };
  const familyRegistry = getFamilyRegistry(wallet) as unknown as {
    getCompatibility: (a: bigint, b: bigint) => Promise<number>;
  };

  const agent = await agentNFT.getAgent(BigInt(agentId));

  // If married, always work with partner
  if (agent.partnerId !== 0n) {
    return { counterpartyId: agent.partnerId, reason: 'married partner' };
  }

  // Filter candidates: not self, not retired, not already married to someone else
  const candidates: { id: number; compatibility: number }[] = [];

  for (const candidateId of allAgentIds) {
    if (candidateId === agentId) continue;

    try {
      const candidate = await agentNFT.getAgent(BigInt(candidateId));
      if (candidate.retired) continue;
      if (candidate.partnerId !== 0n) continue; // already married

      const compat = await familyRegistry.getCompatibility(BigInt(agentId), BigInt(candidateId));
      candidates.push({ id: candidateId, compatibility: Number(compat) });
    } catch {
      // Agent may not exist, skip
      continue;
    }
  }

  if (candidates.length === 0) {
    return { counterpartyId: 0n, reason: 'no eligible counterparty' };
  }

  // Pick highest compatibility; if all zero, pick random
  candidates.sort((a, b) => b.compatibility - a.compatibility);
  const best = candidates[0];

  if (best.compatibility > 0) {
    logger.debug(`Agent ${agentId}: counterparty ${best.id} (compatibility=${best.compatibility})`);
    return { counterpartyId: BigInt(best.id), reason: `highest compatibility (${best.compatibility})` };
  }

  const random = candidates[Math.floor(Math.random() * candidates.length)];
  return { counterpartyId: BigInt(random.id), reason: 'random (all compatibility=0)' };
}
