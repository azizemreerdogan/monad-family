import { getAgentNFT, getFamilyRegistry } from '../contracts';
import { getWallet } from './wallets';
import { addAgent } from './lifecycle';
import { fetchPersonality } from '../ipfs/client';
import { generateChildName } from '../claude/nameGenerator';
import { generatePersonality } from '../personality/generator';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import config from '../config';
import { Agent, JobType } from '../types';

export async function checkAndExecuteChildBirths(agentIds: number[]): Promise<void> {
  const wallet = getWallet(agentIds[0]);
  const agentNFT = getAgentNFT(wallet) as unknown as {
    getAgent: (id: bigint) => Promise<Agent>;
    mintChild: (
      parentAId: bigint,
      parentBId: bigint,
      childOwner: string,
      name: string,
      personalityCID: string,
    ) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };
  const familyRegistry = getFamilyRegistry(wallet) as unknown as {
    approveChild: (parentAId: bigint, parentBId: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  // Find married couples (deduplicate: only process pair once)
  const processedPairs = new Set<string>();

  for (const id of agentIds) {
    try {
      const agent = await agentNFT.getAgent(BigInt(id));
      if (agent.retired || agent.partnerId === 0n) continue;

      const pairKey = agent.id < agent.partnerId
        ? `${agent.id}-${agent.partnerId}`
        : `${agent.partnerId}-${agent.id}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const partner = await agentNFT.getAgent(agent.partnerId);
      if (partner.retired) continue;

      // Eligibility checks
      if (Number(agent.age) < config.minChildAge || Number(partner.age) < config.minChildAge) continue;
      if (agent.childIds.length >= config.maxChildrenPerCouple) continue;

      // Check balances (10% from each parent goes to child)
      if (agent.balance === 0n || partner.balance === 0n) continue;

      const parentAId = agent.id < partner.id ? agent.id : partner.id;
      const parentBId = agent.id < partner.id ? partner.id : agent.id;
      const parentA = parentAId === agent.id ? agent : partner;
      const parentB = parentAId === agent.id ? partner : agent;

      logger.info(`ChildBirth: couple ${parentAId} & ${parentBId} eligible for child`);

      // Two-phase approval: admin wallet approves on behalf of each parent
      const txApproveA = await withRetry(() => familyRegistry.approveChild(parentAId, parentBId));
      await txApproveA.wait();
      logger.debug(`ChildBirth: parent ${parentAId} approved`);

      const txApproveB = await withRetry(() => familyRegistry.approveChild(parentBId, parentAId));
      await txApproveB.wait();
      logger.debug(`ChildBirth: parent ${parentBId} approved`);

      // Generate child name via Claude
      const childName = await generateChildName(
        parentA.name,
        parentB.name,
        parentA.jobType as JobType,
      );

      // Generate personality via Claude + upload to IPFS
      const parentAPersonality = await fetchPersonality(parentA.personalityCID);
      const parentBPersonality = await fetchPersonality(parentB.personalityCID);

      const avgRisk = Math.round((parentA.riskScore + parentB.riskScore) / 2);
      const avgPatience = Math.round((parentA.patience + parentB.patience) / 2);
      const avgSocial = Math.round((parentA.socialScore + parentB.socialScore) / 2);
      const childJobType = parentA.balance >= parentB.balance ? parentA.jobType : parentB.jobType;

      const { cid } = await generatePersonality(parentAPersonality, parentBPersonality, {
        riskScore: avgRisk,
        patience: avgPatience,
        socialScore: avgSocial,
        jobType: childJobType,
      });

      // Mint child on-chain (contract handles trait blending with on-chain randomness)
      const txMint = await withRetry(() => agentNFT.mintChild(parentAId, parentBId, wallet.address, childName, cid));
      await txMint.wait();

      logger.info(`ChildBirth: ${childName} born to parents ${parentAId} & ${parentBId}`, { cid });

      // The new child ID will be picked up via AgentBorn event -> lifecycle.addAgent
      // But we can also try to figure it out from the store for mock mode
      if (config.mockMode) {
        // In mock mode, the child ID is auto-incremented, find the latest
        try {
          const parentAUpdated = await agentNFT.getAgent(parentAId);
          const newChildId = parentAUpdated.childIds[parentAUpdated.childIds.length - 1];
          if (newChildId) addAgent(Number(newChildId));
        } catch {
          // Event handler will pick it up
        }
      }

      // Rate limit: max 1 birth per check cycle
      return;
    } catch (err) {
      logger.error(`ChildBirth: failed for agent ${id}`, err);
      continue;
    }
  }
}
