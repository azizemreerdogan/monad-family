import * as dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

function isMockMode(): boolean {
  if (process.env.MOCK_MODE === 'true') return true;
  const addr = process.env.CONTRACT_AGENT_NFT;
  return !addr || addr === '' || addr === 'mock';
}

function parseAgentIds(): number[] {
  const raw = process.env.AGENT_IDS ?? '1,2,3,4,5';
  return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
}


function parseLogLevel(raw: string | undefined): Config['logLevel'] {
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

const config: Config = {
  monadRpcUrl: process.env.MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz',
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY ?? '',
  contractAddresses: {
    agentNFT: process.env.CONTRACT_AGENT_NFT ?? '',
    familyRegistry: process.env.CONTRACT_FAMILY_REGISTRY ?? '',
    workEngine: process.env.CONTRACT_WORK_ENGINE ?? '',
    marketplace: process.env.CONTRACT_MARKETPLACE ?? '',
  },
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  pinataJwt: process.env.PINATA_JWT ?? '',
  agentIds: parseAgentIds(),
  workIntervalMs: parseInt(process.env.WORK_INTERVAL_MS ?? '120000', 10),
  marriageCheckIntervalMs: parseInt(process.env.MARRIAGE_CHECK_INTERVAL_MS ?? '300000', 10),
  childCheckIntervalMs: parseInt(process.env.CHILD_CHECK_INTERVAL_MS ?? '600000', 10),
  minChildAge: parseInt(process.env.MIN_CHILD_AGE ?? '20', 10),
  maxChildrenPerCouple: parseInt(process.env.MAX_CHILDREN_PER_COUPLE ?? '3', 10),
  enableMarketplace: process.env.ENABLE_MARKETPLACE === 'true',
  mockMode: isMockMode(),
  ipfsGateway: process.env.IPFS_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs',
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
};

export function validate(): void {
  if (config.mockMode) return;

  const required: [string, string][] = [
    ['MONAD_RPC_URL', config.monadRpcUrl],
    ['AGENT_PRIVATE_KEY', config.agentPrivateKey],
    ['CONTRACT_AGENT_NFT', config.contractAddresses.agentNFT],
    ['CONTRACT_WORK_ENGINE', config.contractAddresses.workEngine],
    ['CONTRACT_FAMILY_REGISTRY', config.contractAddresses.familyRegistry],
    ['GEMINI_API_KEY', config.geminiApiKey],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

export default config;
