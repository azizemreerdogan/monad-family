import { ethers } from 'ethers';
import config from '../config';
import { getProvider } from '../provider';

// Hardhat/Foundry test account #0 — safe to use in mock/dev mode only
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

let _wallet: ethers.Wallet | null = null;

// Single admin wallet — signs all transactions on behalf of any agent
export function getWallet(_agentId?: number): ethers.Wallet {
  if (_wallet) return _wallet;

  if (config.mockMode) {
    _wallet = new ethers.Wallet(DEV_PRIVATE_KEY);
  } else {
    const key = config.agentPrivateKey;
    if (!key) throw new Error('AGENT_PRIVATE_KEY is not configured');
    const provider = getProvider() as ethers.JsonRpcProvider;
    _wallet = new ethers.Wallet(key, provider);
  }

  return _wallet;
}
