import { ethers } from 'ethers';
import config from './config';
import { MockProvider } from './contracts/mock/MockProvider';

let _provider: ethers.JsonRpcProvider | MockProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider | MockProvider {
  if (_provider) return _provider;

  if (config.mockMode) {
    _provider = new MockProvider();
  } else {
    _provider = new ethers.JsonRpcProvider(config.monadRpcUrl);
  }

  return _provider;
}

export function getWalletForAgent(agentId: number): ethers.Wallet {
  if (config.mockMode) {
    // Well-known Hardhat test key — NOT for production
    return new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    );
  }

  const key = config.agentPrivateKey;

  if (!key) throw new Error(`No private key configured for agent ${agentId}`);

  const provider = getProvider() as ethers.JsonRpcProvider;
  return new ethers.Wallet(key, provider);
}
