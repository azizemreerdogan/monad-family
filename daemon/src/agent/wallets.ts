import { ethers } from 'ethers';
import config from '../config';
import { getProvider } from '../provider';

// Hardhat/Foundry test account #0 — safe to use in mock/dev mode only
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const walletCache = new Map<number, ethers.Wallet>();

export function getWallet(agentId: number): ethers.Wallet {
  const cached = walletCache.get(agentId);
  if (cached) return cached;

  let key: string;

  if (config.mockMode) {
    key = DEV_PRIVATE_KEY;
  } else {
    const keys = config.agentPrivateKeys;
    key = keys.length > 0 ? (keys[agentId - 1] ?? config.agentPrivateKey) : config.agentPrivateKey;
    if (!key) throw new Error(`No private key configured for agent ${agentId}`);
  }

  const provider = config.mockMode ? undefined : (getProvider() as ethers.JsonRpcProvider);
  const wallet = provider ? new ethers.Wallet(key, provider) : new ethers.Wallet(key);

  walletCache.set(agentId, wallet);
  return wallet;
}
