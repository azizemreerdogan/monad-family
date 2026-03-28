/**
 * Backfill Neo4j from the live AgentNFT + FamilyRegistry contracts.
 * Reads all on-chain agents and their relationships, then upserts into Neo4j.
 * Run: npm run seed
 */
import { ethers } from 'ethers'
import { setupSchema, upsertAgent, createMarriage, upsertBonding, createParentOf } from './neo4j'
import { config } from './config'
import { Agent, JobType } from './types'

const AGENT_NFT_ABI = [
  'function totalAgents() view returns (uint256)',
  'function exists(uint256 agentId) view returns (bool)',
  'function getAgent(uint256 agentId) view returns (tuple(uint256 id, string name, uint8 jobType, uint8 riskScore, uint8 patience, uint8 socialScore, uint256 age, uint256 balance, uint256 lockedBalance, uint256 partnerId, uint256 maxAge, uint256[] childIds, bool retired, bool independent, bool sicknessEvaluated, uint8 sicknessLevel, string personalityCID))',
]

const FAMILY_REGISTRY_ABI = [
  'function getCompatibility(uint256 agentAId, uint256 agentBId) view returns (uint8)',
  'function areMarried(uint256 agentAId, uint256 agentBId) view returns (bool)',
]

const JOB_TYPES: JobType[] = ['trader', 'farmer', 'lender']

function randomPos(idx: number): { posX: number; posY: number } {
  const { width, height, padding } = config.canvas
  // Spread agents across the canvas deterministically by index
  const cols = Math.ceil(Math.sqrt(20))
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const cellW = (width - padding * 2) / cols
  const cellH = (height - padding * 2) / cols
  return {
    posX: Math.floor(padding + col * cellW + cellW * 0.3 + Math.random() * cellW * 0.4),
    posY: Math.floor(padding + row * cellH + cellH * 0.3 + Math.random() * cellH * 0.4),
  }
}

async function seed() {
  console.log('[seed] Connecting to RPC:', config.rpc.url)
  console.log('[seed] AgentNFT address:    ', config.contracts.agentNFT)
  console.log('[seed] FamilyRegistry addr: ', config.contracts.familyRegistry)

  const provider = new ethers.JsonRpcProvider(config.rpc.url)

  // Verify contract is deployed at that address
  const code = await provider.getCode(config.contracts.agentNFT)
  if (code === '0x') {
    console.error('[seed] ERROR: No contract found at AgentNFT address:', config.contracts.agentNFT)
    console.error('[seed] Check that AGENT_NFT_ADDRESS in your .env is correct and contracts are deployed.')
    process.exit(1)
  }

  const agentNFT = new ethers.Contract(config.contracts.agentNFT, AGENT_NFT_ABI, provider)
  const familyRegistry = new ethers.Contract(config.contracts.familyRegistry, FAMILY_REGISTRY_ABI, provider)

  console.log('[seed] Setting up Neo4j schema...')
  await setupSchema()

  // ── Fetch all agents ───────────────────────────────────────────────────────
  let total: number
  try {
    total = Number(await agentNFT.totalAgents())
  } catch (err) {
    console.error('[seed] ERROR: totalAgents() call failed.')
    console.error('[seed] The contract may not match the expected ABI, or the RPC is unreachable.')
    console.error('[seed] Details:', (err as Error).message)
    process.exit(1)
  }
  console.log(`[seed] Found ${total} agents on-chain`)

  const agents: Agent[] = []

  for (let i = 1; i <= total; i++) {
    try {
      const exists = await agentNFT.exists(BigInt(i))
      if (!exists) {
        console.log(`[seed]   Agent ${i}: does not exist, skipping`)
        continue
      }

      const d = await agentNFT.getAgent(BigInt(i))
      const pos = randomPos(i - 1)

      const agent: Agent = {
        id: String(i),
        name: d.name,
        jobType: JOB_TYPES[Number(d.jobType)] ?? 'trader',
        riskScore: Number(d.riskScore),
        patienceScore: Number(d.patience),
        socialScore: Number(d.socialScore),
        age: Number(d.age),
        balance: d.balance.toString(),
        retired: d.retired,
        lastThought: '',
        personalityCID: d.personalityCID || '',
        ...pos,
        createdAt: new Date().toISOString(),
      }

      await upsertAgent(agent)
      agents.push(agent)
      console.log(`[seed]   ✓ ${agent.name} (id=${i}, job=${agent.jobType}, age=${agent.age}, balance=${ethers.formatEther(d.balance)} MON)`)
    } catch (err) {
      console.error(`[seed]   ✗ Agent ${i} failed:`, err)
    }
  }

  // ── Fetch relationships ────────────────────────────────────────────────────
  console.log('[seed] Resolving relationships...')

  const processedMarriages = new Set<string>()

  for (const agent of agents) {
    const d = await agentNFT.getAgent(BigInt(agent.id))

    // Marriage
    const partnerId = Number(d.partnerId)
    if (partnerId !== 0) {
      const key = [Number(agent.id), partnerId].sort().join('-')
      if (!processedMarriages.has(key)) {
        processedMarriages.add(key)
        try {
          await createMarriage(agent.id, String(partnerId))
          console.log(`[seed]   ♥ Marriage: ${agent.id} ↔ ${partnerId}`)
        } catch (err) {
          console.error(`[seed]   Marriage ${agent.id}↔${partnerId} failed:`, err)
        }
      }
    }

    // Parent-of relationships
    for (const childId of d.childIds) {
      try {
        await createParentOf(agent.id, String(childId), '0')
        console.log(`[seed]   → Parent-of: ${agent.id} → ${childId}`)
      } catch (err) {
        console.error(`[seed]   Parent-of ${agent.id}→${childId} failed:`, err)
      }
    }
  }

  // ── Compatibility scores ───────────────────────────────────────────────────
  console.log('[seed] Fetching compatibility scores...')

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      try {
        const compat = Number(
          await familyRegistry.getCompatibility(BigInt(agents[i].id), BigInt(agents[j].id))
        )
        if (compat > 0) {
          await upsertBonding(agents[i].id, agents[j].id, compat)
          console.log(`[seed]   ~ Bonding: ${agents[i].id}↔${agents[j].id} = ${compat}%`)
        }
      } catch {
        // Skip pairs with no compatibility data
      }
    }
  }

  console.log(`[seed] Done! ${agents.length} agents backfilled from chain.`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err)
  process.exit(1)
})
