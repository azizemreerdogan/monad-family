/**
 * Seed script — mints the 6 founding agents on-chain.
 * Run AFTER contracts are deployed:
 *   ts-node scripts/seed.ts
 *
 * In mock mode, just logs what it would do.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import config, { validate } from '../src/config';
import { logger } from '../src/utils/logger';
import { SEED_AGENTS } from '../src/seeds/agents';
import { uploadPersonality } from '../src/ipfs/client';
import { getAgentNFT } from '../src/contracts';
import { getWallet } from '../src/agent/wallets';

async function seed(): Promise<void> {
  logger.info('Seed script starting', { mockMode: config.mockMode, agents: SEED_AGENTS.length });

  if (!config.mockMode) {
    validate();
  }

  const wallet = getWallet(0);
  const agentNFT = getAgentNFT(wallet) as unknown as {
    mint: (
      name: string,
      jobType: number,
      riskScore: number,
      patience: number,
      socialScore: number,
      personalityCID: string,
    ) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  for (const agent of SEED_AGENTS) {
    logger.info(`Seeding agent: ${agent.name} (jobType=${agent.jobType})`);

    const cid = await uploadPersonality(agent.personalityText);
    logger.info(`Personality uploaded`, { name: agent.name, cid });

    if (config.mockMode) {
      logger.info(`[MOCK] Would call mint("${agent.name}", ${agent.jobType}, ${agent.riskScore}, ${agent.patience}, ${agent.socialScore}, "${cid}")`);
      continue;
    }

    const tx = await agentNFT.mint(
      agent.name,
      agent.jobType,
      agent.riskScore,
      agent.patience,
      agent.socialScore,
      cid,
    );
    await tx.wait();
    logger.info(`Agent minted on-chain`, { name: agent.name, txHash: tx.hash });
  }

  logger.info('Seed complete');
}

seed().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});
