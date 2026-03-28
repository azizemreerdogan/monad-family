import { getAgentNFT, getWorkEngine } from '../contracts';
import { fetchPersonality } from '../ipfs/client';
import { callClaude } from '../claude/client';
import { buildWorkPrompt } from '../claude/prompts';
import { parseWorkResponse } from '../claude/parser';
import { selectCounterparty } from './counterparty';
import { getWallet } from './wallets';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import { ethers } from 'ethers';
import { Agent } from '../types';
import { maybeFireRandomEvent } from './randomEvents';

export async function runAgent(agentId: number, allAgentIds: number[]): Promise<void> {
  logger.debug(`Agent ${agentId}: work cycle starting`);

  try {
    const wallet = getWallet(agentId);
    const agentNFT = getAgentNFT(wallet) as unknown as { getAgent: (id: bigint) => Promise<Agent> };
    const workEngine = getWorkEngine(wallet) as unknown as {
      work: (id: bigint, counterpartyId: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
    };

    // 1. Fetch agent state
    const agent = await agentNFT.getAgent(BigInt(agentId));

    if (agent.retired) {
      logger.info(`Agent ${agentId} (${agent.name}): retired, skipping`);
      return;
    }

    if (agent.age >= agent.maxAge) {
      logger.info(`Agent ${agentId} (${agent.name}): age ${agent.age}/${agent.maxAge}, retiring next cycle`);
      return;
    }

    // 2. Fetch personality (cache-first)
    const personality = await fetchPersonality(agent.personalityCID);

    // 3. Build prompt + call Claude
    const userMessage = buildWorkPrompt(agent);
    const responseText = await callClaude({ system: personality, userMessage });

    // 4. Parse Claude's response
    const result = parseWorkResponse(responseText);

    // 5. Select counterparty for compatibility building
    const { counterpartyId, reason } = await selectCounterparty(agentId, allAgentIds);

    logger.info(`Agent ${agentId} (${agent.name}): ${result.action} — ${result.summary}`, {
      age: Number(agent.age),
      balance: parseFloat(ethers.formatEther(agent.balance)).toFixed(3),
      counterparty: counterpartyId !== 0n ? `${counterpartyId} (${reason})` : 'none',
    });

    // 6. Submit work tx with counterparty
    const tx = await withRetry(() => workEngine.work(BigInt(agentId), counterpartyId));
    await tx.wait();

    logger.info(`Agent ${agentId} (${agent.name}): work tx confirmed`, { hash: tx.hash });

    // 7. Maybe fire a random event after work
    await maybeFireRandomEvent(agentId, allAgentIds);
  } catch (err) {
    logger.error(`Agent ${agentId}: work cycle failed`, err);
    // Do NOT rethrow — a single agent failure must not crash the daemon
  }
}
