import { ethers } from 'ethers'
import { config } from './config'
import {
  updateAgentWork,
  upsertAgent,
  createMarriage,
  upsertBonding,
  createParentOf,
  setAgentRetired,
  addLifeEvent,
} from './neo4j'
import { Agent, JobType, WsMessage } from './types'

// ─── Correct ABIs matching the actual deployed contracts ─────────────────────

// AgentNFT: emits AgentBorn; has read functions for fetching agent state
const AGENT_NFT_ABI = [
  'event AgentBorn(uint256 indexed childId, uint256 indexed parentAId, uint256 indexed parentBId, string name)',
  'function getAgent(uint256 agentId) view returns (tuple(uint256 id, string name, uint8 jobType, uint8 riskScore, uint8 patience, uint8 socialScore, uint256 age, uint256 balance, uint256 lockedBalance, uint256 partnerId, uint256 maxAge, uint256[] childIds, bool retired, bool independent, bool sicknessEvaluated, uint8 sicknessLevel, string personalityCID))',
]

// WorkEngine: emits AgentWorked and AgentRetired
const WORK_ENGINE_ABI = [
  'event AgentWorked(uint256 indexed agentId, uint256 earned, uint256 newAge)',
  'event AgentRetired(uint256 indexed agentId, uint256 finalBalance)',
]

// FamilyRegistry: emits AgentBonded and AgentMarried
const FAMILY_REGISTRY_ABI = [
  'event AgentBonded(uint256 indexed agentA, uint256 indexed agentB, uint8 compatibility)',
  'event AgentMarried(uint256 indexed agentA, uint256 indexed agentB)',
]

const JOB_TYPES: JobType[] = ['trader', 'farmer', 'lender']

let broadcastFn: ((msg: WsMessage) => void) | null = null

export function setBroadcast(fn: (msg: WsMessage) => void): void {
  broadcastFn = fn
}

function broadcast(msg: WsMessage): void {
  if (broadcastFn) broadcastFn(msg)
}

function randomPos(): { posX: number; posY: number } {
  const { width, height, padding } = config.canvas
  return {
    posX: Math.floor(padding + Math.random() * (width - padding * 2)),
    posY: Math.floor(padding + Math.random() * (height - padding * 2)),
  }
}

const POLL_INTERVAL_MS = 2000

export async function startIndexer(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(config.rpc.url)

  // Contract instances for reading on-chain state
  const agentNFTContract = new ethers.Contract(config.contracts.agentNFT, AGENT_NFT_ABI, provider)

  // Interfaces for parsing events from each contract
  const agentNFTIface = new ethers.Interface(AGENT_NFT_ABI)
  const workEngineIface = new ethers.Interface(WORK_ENGINE_ABI)
  const familyRegistryIface = new ethers.Interface(FAMILY_REGISTRY_ABI)

  // Map topic hashes to { eventName, iface, contractAddress }
  interface EventMapping {
    name: string
    iface: ethers.Interface
    address: string
  }
  const topicMap = new Map<string, EventMapping>()

  // AgentNFT events
  for (const name of ['AgentBorn']) {
    const topic = agentNFTIface.getEvent(name)!.topicHash
    topicMap.set(topic, { name, iface: agentNFTIface, address: config.contracts.agentNFT })
  }

  // WorkEngine events
  for (const name of ['AgentWorked', 'AgentRetired']) {
    const topic = workEngineIface.getEvent(name)!.topicHash
    topicMap.set(topic, { name, iface: workEngineIface, address: config.contracts.workEngine })
  }

  // FamilyRegistry events
  for (const name of ['AgentBonded', 'AgentMarried']) {
    const topic = familyRegistryIface.getEvent(name)!.topicHash
    topicMap.set(topic, { name, iface: familyRegistryIface, address: config.contracts.familyRegistry })
  }

  // Collect all contract addresses to poll
  const contractAddresses = [
    config.contracts.agentNFT,
    config.contracts.workEngine,
    config.contracts.familyRegistry,
  ]

  let fromBlock = await provider.getBlockNumber()
  console.log(`[indexer] Polling for events from block ${fromBlock} every ${POLL_INTERVAL_MS}ms`)
  console.log(`[indexer] Watching contracts: AgentNFT=${config.contracts.agentNFT}, WorkEngine=${config.contracts.workEngine}, FamilyRegistry=${config.contracts.familyRegistry}`)

  async function poll() {
    try {
      const toBlock = await provider.getBlockNumber()
      if (toBlock < fromBlock) return

      // Poll each contract separately
      for (const addr of contractAddresses) {
        try {
          const logs = await provider.getLogs({
            address: addr,
            fromBlock,
            toBlock,
          })

          for (const log of logs) {
            const mapping = topicMap.get(log.topics[0])
            if (!mapping) continue
            try {
              const parsed = mapping.iface.parseLog({ topics: log.topics as string[], data: log.data })
              if (!parsed) continue
              await handleEvent(mapping.name, parsed.args, agentNFTContract)
            } catch (err) {
              console.error(`[indexer] Failed to parse ${mapping.name} log:`, err)
            }
          }
        } catch (err) {
          console.error(`[indexer] Poll error for contract ${addr}:`, err)
        }
      }

      fromBlock = toBlock + 1
    } catch (err) {
      console.error('[indexer] Poll error:', err)
    }
  }

  setInterval(poll, POLL_INTERVAL_MS)
}

async function handleEvent(
  name: string,
  args: ethers.Result,
  agentNFTContract: ethers.Contract,
): Promise<void> {

  if (name === 'AgentWorked') {
    // Event: AgentWorked(agentId, earned, newAge) — no balance or thought in event
    const agentId = args[0].toString()
    const earned = args[1].toString()
    const newAge = Number(args[2])

    // Read current balance from AgentNFT contract
    let newBalance = '0'
    let lastThought = `Earned ${ethers.formatEther(earned)} MON`
    try {
      const agentData = await agentNFTContract.getAgent(BigInt(agentId))
      newBalance = agentData.balance.toString()
    } catch (err) {
      console.error(`[indexer] Failed to read agent ${agentId} balance from chain:`, err)
    }

    await updateAgentWork(agentId, newBalance, newAge, lastThought)
    await addLifeEvent(`worked-${agentId}-${Date.now()}`, agentId, 'AgentWorked', {
      earned, newBalance, newAge, lastThought,
    })
    broadcast({ type: 'AGENT_WORKED', agentId, earned, newBalance, newAge, lastThought })
    console.log(`[indexer] AgentWorked: ${agentId} earned ${earned}`)
  }

  else if (name === 'AgentBorn') {
    // Event: AgentBorn(childId, parentAId, parentBId, name) — only 4 args
    const childId = args[0].toString()
    const parent1Id = args[1].toString()
    const parent2Id = args[2].toString()
    const agentName = args[3] as string

    // Read full agent data from AgentNFT contract
    const pos = randomPos()
    let agent: Agent = {
      id: childId,
      name: agentName,
      jobType: 'trader',
      riskScore: 0,
      patienceScore: 0,
      socialScore: 0,
      age: 0,
      balance: '0',
      retired: false,
      lastThought: '',
      personalityCID: '',
      ...pos,
      createdAt: new Date().toISOString(),
    }

    try {
      const agentData = await agentNFTContract.getAgent(BigInt(childId))
      agent = {
        id: childId,
        name: agentData.name || agentName,
        jobType: JOB_TYPES[Number(agentData.jobType)] ?? 'trader',
        riskScore: Number(agentData.riskScore),
        patienceScore: Number(agentData.patience),
        socialScore: Number(agentData.socialScore),
        age: Number(agentData.age),
        balance: agentData.balance.toString(),
        retired: agentData.retired,
        lastThought: '',
        personalityCID: agentData.personalityCID || '',
        ...pos,
        createdAt: new Date().toISOString(),
      }
    } catch (err) {
      console.error(`[indexer] Failed to read agent ${childId} from chain:`, err)
    }

    await upsertAgent(agent)
    await createParentOf(parent1Id, childId, '0')
    await createParentOf(parent2Id, childId, '0')
    await addLifeEvent(`born-${childId}`, childId, 'AgentBorn', { parent1Id, parent2Id })
    broadcast({ type: 'AGENT_BORN', agent, parent1Id, parent2Id })
    console.log(`[indexer] AgentBorn: ${agentName} (${childId})`)
  }

  else if (name === 'AgentMarried') {
    // Event: AgentMarried(agentA, agentB)
    const agent1Id = args[0].toString()
    const agent2Id = args[1].toString()
    await createMarriage(agent1Id, agent2Id)
    await addLifeEvent(`married-${agent1Id}-${agent2Id}`, agent1Id, 'AgentMarried', { agent2Id })
    broadcast({ type: 'AGENT_MARRIED', agent1Id, agent2Id })
    console.log(`[indexer] AgentMarried: ${agent1Id} ↔ ${agent2Id}`)
  }

  else if (name === 'AgentBonded') {
    // Event: AgentBonded(agentA, agentB, compatibility)
    const agent1Id = args[0].toString()
    const agent2Id = args[1].toString()
    const compatibilityScore = Number(args[2])
    await upsertBonding(agent1Id, agent2Id, compatibilityScore)
    await addLifeEvent(`bonded-${agent1Id}-${agent2Id}-${Date.now()}`, agent1Id, 'AgentBonded', {
      agent2Id, compatibilityScore,
    })
    broadcast({ type: 'AGENT_BONDED', agent1Id, agent2Id, compatibilityScore })
    console.log(`[indexer] AgentBonded: ${agent1Id} ↔ ${agent2Id} (${compatibilityScore}%)`)
  }

  else if (name === 'AgentRetired') {
    // Event: AgentRetired(agentId, finalBalance)
    const agentId = args[0].toString()
    const finalBalance = args[1].toString()
    await setAgentRetired(agentId, finalBalance)
    await addLifeEvent(`retired-${agentId}`, agentId, 'AgentRetired', { finalBalance })
    broadcast({ type: 'AGENT_RETIRED', agentId, finalBalance })
    console.log(`[indexer] AgentRetired: ${agentId}`)
  }
}
