import { getAgentNFT, getFamilyRegistry } from '../contracts';
import { getWallet } from './wallets';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import { Agent } from '../types';

export async function checkAndExecuteMarriages(agentIds: number[]): Promise<void> {
  const wallet = getWallet(agentIds[0]);
  const agentNFT = getAgentNFT(wallet) as unknown as { getAgent: (id: bigint) => Promise<Agent> };
  const familyRegistry = getFamilyRegistry(wallet) as unknown as {
    getCompatibility: (a: bigint, b: bigint) => Promise<number>;
    areMarried: (a: bigint, b: bigint) => Promise<boolean>;
    approveMarriage: (selfId: bigint, otherId: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
    marry: (a: bigint, b: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  // Find eligible pairs: compatibility >= 80, both single, not retired
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      const aId = BigInt(agentIds[i]);
      const bId = BigInt(agentIds[j]);

      try {
        const compat = await familyRegistry.getCompatibility(aId, bId);
        if (Number(compat) < 80) continue;

        const married = await familyRegistry.areMarried(aId, bId);
        if (married) continue;

        const agentA = await agentNFT.getAgent(aId);
        const agentB = await agentNFT.getAgent(bId);
        if (agentA.retired || agentB.retired) continue;
        if (agentA.partnerId !== 0n || agentB.partnerId !== 0n) continue;

        logger.info(`Marriage: agents ${agentIds[i]} & ${agentIds[j]} eligible (compatibility=${compat})`);

        // Two-phase approval: admin wallet approves on behalf of each agent
        const txApproveA = await withRetry(() => familyRegistry.approveMarriage(aId, bId));
        await txApproveA.wait();
        logger.debug(`Marriage: agent ${agentIds[i]} approved`);

        const txApproveB = await withRetry(() => familyRegistry.approveMarriage(bId, aId));
        await txApproveB.wait();
        logger.debug(`Marriage: agent ${agentIds[j]} approved`);

        // Execute marriage
        const txMarry = await withRetry(() => familyRegistry.marry(aId, bId));
        await txMarry.wait();

        logger.info(`Marriage: agents ${agentIds[i]} & ${agentIds[j]} are now married!`);

        // Rate limit: max 1 marriage per check cycle
        return;
      } catch (err) {
        logger.error(`Marriage: failed for agents ${agentIds[i]} & ${agentIds[j]}`, err);
        continue;
      }
    }
  }
}
