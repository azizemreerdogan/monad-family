import { ethers } from 'ethers';
import config from '../config';
import { mockAgentNFT, mockFamilyRegistry, mockWorkEngine, mockMarketplace } from './mock/MockContracts';

import AgentNFTAbi from './abis/AgentNFT.json';
import FamilyRegistryAbi from './abis/FamilyRegistry.json';
import WorkEngineAbi from './abis/WorkEngine.json';
import MarketplaceAbi from './abis/Marketplace.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = ethers.Contract | any;

export function getAgentNFT(signerOrProvider?: ethers.Signer | ethers.Provider): AnyContract {
  if (config.mockMode) return mockAgentNFT;
  if (!signerOrProvider) throw new Error('signerOrProvider required in non-mock mode');
  return new ethers.Contract(config.contractAddresses.agentNFT, AgentNFTAbi, signerOrProvider);
}

export function getFamilyRegistry(signerOrProvider?: ethers.Signer | ethers.Provider): AnyContract {
  if (config.mockMode) return mockFamilyRegistry;
  if (!signerOrProvider) throw new Error('signerOrProvider required in non-mock mode');
  return new ethers.Contract(config.contractAddresses.familyRegistry, FamilyRegistryAbi, signerOrProvider);
}

export function getWorkEngine(signerOrProvider?: ethers.Signer | ethers.Provider): AnyContract {
  if (config.mockMode) return mockWorkEngine;
  if (!signerOrProvider) throw new Error('signerOrProvider required in non-mock mode');
  return new ethers.Contract(config.contractAddresses.workEngine, WorkEngineAbi, signerOrProvider);
}

export function getMarketplace(signerOrProvider?: ethers.Signer | ethers.Provider): AnyContract {
  if (config.mockMode) return mockMarketplace;
  if (!signerOrProvider) throw new Error('signerOrProvider required in non-mock mode');
  return new ethers.Contract(config.contractAddresses.marketplace, MarketplaceAbi, signerOrProvider);
}
