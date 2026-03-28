export const JOB_NAMES = ['Trader', 'Farmer', 'Lender'] as const;
export type JobType = 0 | 1 | 2;

export interface Agent {
  id: bigint;
  name: string;
  jobType: JobType;
  riskScore: number;
  patience: number;
  socialScore: number;
  age: bigint;
  balance: bigint;
  partnerId: bigint;
  childIds: bigint[];
  retired: boolean;
  personalityCID: string;
}

export interface AgentTraits {
  riskScore: number;
  patience: number;
  socialScore: number;
  jobType: JobType;
}

export interface SeedAgent {
  id: number;
  name: string;
  jobType: JobType;
  riskScore: number;
  patience: number;
  socialScore: number;
  personalityText: string;
}

export interface WorkResult {
  action: 'swap' | 'stake' | 'lend' | 'unknown';
  summary: string;
}

export interface Listing {
  agentId: bigint;
  seller: string;
  price: bigint;
  active: boolean;
}

export interface PersonalityResult {
  personalityText: string;
  cid: string;
}

export interface CounterpartySelection {
  counterpartyId: bigint;
  reason: string;
}

export interface MarriageCandidate {
  agentAId: bigint;
  agentBId: bigint;
  compatibility: number;
}

export interface ChildBirthRequest {
  parentAId: bigint;
  parentBId: bigint;
  childName: string;
  personalityCID: string;
}

export interface EventCallbacks {
  onAgentBorn?: (childId: bigint, parentAId: bigint, parentBId: bigint, name: string) => void;
  onAgentRetired?: (agentId: bigint, finalBalance: bigint) => void;
  onAgentSold?: (agentId: bigint, price: bigint, buyer: string) => void;
}

export interface Config {
  monadRpcUrl: string;
  agentPrivateKey: string;
  agentPrivateKeys: string[];
  contractAddresses: {
    agentNFT: string;
    familyRegistry: string;
    workEngine: string;
    marketplace: string;
  };
  anthropicApiKey: string;
  pinataJwt: string;
  agentIds: number[];
  workIntervalMs: number;
  marriageCheckIntervalMs: number;
  childCheckIntervalMs: number;
  minChildAge: number;
  maxChildrenPerCouple: number;
  enableMarketplace: boolean;
  mockMode: boolean;
  ipfsGateway: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
