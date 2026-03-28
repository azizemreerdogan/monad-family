import * as dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { SEED_AGENTS } from '../seeds/agents';
import { getAgentNFT } from '../contracts';
import { getProvider } from '../provider';
import { logger } from '../utils/logger';
import config from '../config';

async function main() {
  if (config.mockMode) {
    logger.error('Cannot mint in mock mode. Set MOCK_MODE=false and configure contract addresses.');
    process.exit(1);
  }

  const provider = getProvider() as ethers.JsonRpcProvider;
  const wallet = new ethers.Wallet(config.agentPrivateKey, provider);
  const agentNFT = getAgentNFT(wallet);

  logger.info(`Minting ${SEED_AGENTS.length} agents from wallet ${wallet.address}`);

  // Check how many agents already exist
  const totalAgents = await agentNFT.totalAgents();
  logger.info(`Agents already minted: ${totalAgents}`);

  if (totalAgents >= BigInt(SEED_AGENTS.length)) {
    logger.info('All seed agents already minted. Nothing to do.');
    return;
  }

  const startFrom = Number(totalAgents);

  for (let i = startFrom; i < SEED_AGENTS.length; i++) {
    const seed = SEED_AGENTS[i];

    // Use placeholder CID (IPFS skipped)
    const cid = `placeholder-${seed.id}`;

    logger.info(`[${i + 1}/${SEED_AGENTS.length}] Minting ${seed.name} (job=${seed.jobType}, risk=${seed.riskScore}, patience=${seed.patience}, social=${seed.socialScore})...`);
    const tx = await agentNFT.mint(
      wallet.address,
      seed.name,
      seed.jobType,
      seed.riskScore,
      seed.patience,
      seed.socialScore,
      cid,
    );

    const receipt = await tx.wait();
    logger.info(`  Minted! tx=${receipt.hash}`);
  }

  const finalTotal = await agentNFT.totalAgents();
  logger.info(`Done. Total agents on-chain: ${finalTotal}`);
}

main().catch((err) => {
  logger.error('Mint script failed', err);
  process.exit(1);
});
