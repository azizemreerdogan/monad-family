import dotenv from 'dotenv'
dotenv.config()

function require_env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const config = {
  neo4j: {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'password',
  },
  rpc: {
    url: process.env.RPC_URL ?? 'https://testnet-rpc.monad.xyz',
  },
  contracts: {
    agentNFT: process.env.AGENT_NFT_ADDRESS ?? '0x0000000000000000000000000000000000000001',
    familyRegistry: process.env.FAMILY_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000002',
    workEngine: process.env.WORK_ENGINE_ADDRESS ?? '0x0000000000000000000000000000000000000003',
    marketplace: process.env.MARKETPLACE_ADDRESS ?? '0x0000000000000000000000000000000000000004',
  },
  api: {
    port: parseInt(process.env.API_PORT ?? '3001', 10),
  },
  canvas: {
    width: 1400,
    height: 800,
    padding: 80,
  },
}
