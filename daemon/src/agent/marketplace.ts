import { getMarketplace } from '../contracts';
import { getWallet } from './wallets';
import { removeAgent } from './lifecycle';
import { logger } from '../utils/logger';

export function startMarketplaceMonitor(defaultAgentId: number): void {
  const wallet = getWallet(defaultAgentId);
  const marketplace = getMarketplace(wallet) as unknown as {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  marketplace.on('AgentListed', (agentId: unknown, price: unknown, seller: unknown) => {
    logger.info(`Marketplace: agent ${agentId} listed for ${price} wei by ${seller}`);
  });

  marketplace.on('AgentSold', (agentId: unknown, price: unknown, buyer: unknown) => {
    logger.info(`Marketplace: agent ${agentId} sold for ${price} wei to ${buyer}`);
    // Remove from daemon if ownership changed
    removeAgent(Number(agentId));
  });

  logger.info('Marketplace monitor started');
}

export async function listAgentForSale(
  agentId: number,
  priceWei: bigint,
): Promise<void> {
  const wallet = getWallet(agentId);
  const marketplace = getMarketplace(wallet) as unknown as {
    listAgent: (id: bigint, price: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  const tx = await marketplace.listAgent(BigInt(agentId), priceWei);
  await tx.wait();
  logger.info(`Marketplace: agent ${agentId} listed for ${priceWei} wei`);
}

export async function delistAgent(agentId: number): Promise<void> {
  const wallet = getWallet(agentId);
  const marketplace = getMarketplace(wallet) as unknown as {
    delistAgent: (id: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  const tx = await marketplace.delistAgent(BigInt(agentId));
  await tx.wait();
  logger.info(`Marketplace: agent ${agentId} delisted`);
}
