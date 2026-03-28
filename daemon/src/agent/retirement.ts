import { getAgentNFT, getMarketplace } from '../contracts';
import { getWallet } from './wallets';
import { removeAgent } from './lifecycle';
import { logger } from '../utils/logger';
import { Agent, Listing } from '../types';

export async function checkRetirements(agentIds: number[]): Promise<void> {
  const wallet = getWallet(agentIds[0]);
  const agentNFT = getAgentNFT(wallet) as unknown as { getAgent: (id: bigint) => Promise<Agent> };
  const marketplace = getMarketplace(wallet) as unknown as {
    getListing: (id: bigint) => Promise<Listing>;
    delistAgent: (id: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  for (const id of agentIds) {
    try {
      const agent = await agentNFT.getAgent(BigInt(id));

      if (!agent.retired) {
        if (agent.age >= 95n) {
          logger.warn(`Agent ${id} (${agent.name}): approaching retirement (age=${agent.age}/100)`);
        }
        continue;
      }

      // Agent is retired — cleanup
      logger.info(`Retirement cleanup: agent ${id} (${agent.name})`);

      // Try to delist from marketplace if listed
      try {
        const listing = await marketplace.getListing(BigInt(id));
        if (listing.active) {
          const tx = await marketplace.delistAgent(BigInt(id));
          await tx.wait();
          logger.info(`Retirement: delisted agent ${id} from marketplace`);
        }
      } catch {
        // No listing or delist failed — not critical
      }

      // Remove from scheduler
      removeAgent(id);
    } catch (err) {
      logger.error(`Retirement check failed for agent ${id}`, err);
    }
  }
}
