import { ethers } from 'ethers';
import { getAgentNFT, getFamilyRegistry } from '../contracts';
import { getWallet } from './wallets';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

// How often a random event fires per agent per check (0–1)
const EVENT_PROBABILITY = 0.15;

interface RandomEvent {
  name: string;
  weight: number; // relative weight for weighted random selection
  execute: (agentId: number, allAgentIds: number[]) => Promise<void>;
}

const EVENTS: RandomEvent[] = [
  {
    name: 'LotteryWin',
    weight: 5,
    async execute(agentId) {
      const wallet = getWallet(agentId);
      const agentNFT = getAgentNFT(wallet) as unknown as {
        increaseBalance: (id: bigint, amount: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
      };
      const bonus = ethers.parseEther((Math.random() * 0.5 + 0.1).toFixed(4));
      const tx = await withRetry(() => agentNFT.increaseBalance(BigInt(agentId), bonus));
      await tx.wait();
      logger.info(`Agent ${agentId}: [LotteryWin] gained ${ethers.formatEther(bonus)} MON`, { event: 'LotteryWin' });
    },
  },
  {
    name: 'WorkBonus',
    weight: 10,
    async execute(agentId) {
      const wallet = getWallet(agentId);
      const agentNFT = getAgentNFT(wallet) as unknown as {
        increaseBalance: (id: bigint, amount: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
      };
      const bonus = ethers.parseEther((Math.random() * 0.2 + 0.05).toFixed(4));
      const tx = await withRetry(() => agentNFT.increaseBalance(BigInt(agentId), bonus));
      await tx.wait();
      logger.info(`Agent ${agentId}: [WorkBonus] performance bonus ${ethers.formatEther(bonus)} MON`, { event: 'WorkBonus' });
    },
  },
  {
    name: 'FriendshipBoost',
    weight: 15,
    async execute(agentId, allAgentIds) {
      const others = allAgentIds.filter((id) => id !== agentId);
      if (others.length === 0) return;
      const targetId = others[Math.floor(Math.random() * others.length)];

      const wallet = getWallet(agentId);
      const familyRegistry = getFamilyRegistry(wallet) as unknown as {
        incrementCompatibility: (a: bigint, b: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
      };

      // Boost compatibility 3 times (simulate a strong positive interaction)
      for (let i = 0; i < 3; i++) {
        const tx = await withRetry(() => familyRegistry.incrementCompatibility(BigInt(agentId), BigInt(targetId)));
        await tx.wait();
      }
      logger.info(`Agent ${agentId}: [FriendshipBoost] bonded strongly with agent ${targetId}`, { event: 'FriendshipBoost', targetId });
    },
  },
  {
    name: 'MarketCrashSkip',
    weight: 8,
    async execute(agentId) {
      // No on-chain action — just skip this agent's upcoming work cycle by doing nothing.
      // The scheduler will still run next interval normally.
      logger.info(`Agent ${agentId}: [MarketCrashSkip] market crashed — skipping work this cycle`, { event: 'MarketCrashSkip' });
    },
  },
  {
    name: 'InheritanceBonus',
    weight: 7,
    async execute(agentId, allAgentIds) {
      // Pick a random retired/old agent as the "benefactor" and give this agent a small windfall
      const wallet = getWallet(agentId);
      const agentNFT = getAgentNFT(wallet) as unknown as {
        increaseBalance: (id: bigint, amount: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
        getAgent: (id: bigint) => Promise<{ age: bigint; retired: boolean }>;
      };

      // Find a retired agent among active list to source inheritance from
      let benefactorId: number | null = null;
      for (const id of allAgentIds) {
        if (id === agentId) continue;
        try {
          const other = await agentNFT.getAgent(BigInt(id));
          if (other.retired || other.age >= 80n) { benefactorId = id; break; }
        } catch { /* skip */ }
      }

      const inheritance = ethers.parseEther((Math.random() * 0.3 + 0.1).toFixed(4));
      const tx = await withRetry(() => agentNFT.increaseBalance(BigInt(agentId), inheritance));
      await tx.wait();
      logger.info(
        `Agent ${agentId}: [InheritanceBonus] received ${ethers.formatEther(inheritance)} MON inheritance` +
        (benefactorId ? ` from agent ${benefactorId}` : ''),
        { event: 'InheritanceBonus', benefactorId },
      );
    },
  },
];

const TOTAL_WEIGHT = EVENTS.reduce((sum, e) => sum + e.weight, 0);

function pickEvent(): RandomEvent {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const event of EVENTS) {
    r -= event.weight;
    if (r <= 0) return event;
  }
  return EVENTS[EVENTS.length - 1];
}

export async function maybeFireRandomEvent(agentId: number, allAgentIds: number[]): Promise<void> {
  if (Math.random() > EVENT_PROBABILITY) return;

  const event = pickEvent();
  try {
    await event.execute(agentId, allAgentIds);
  } catch (err) {
    logger.error(`Agent ${agentId}: random event [${event.name}] failed`, err);
    // Non-fatal — do not rethrow
  }
}
