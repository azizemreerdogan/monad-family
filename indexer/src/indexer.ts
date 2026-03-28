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

const AGENT_NFT_ABI = [
  'event AgentWorked(uint256 indexed agentId, uint256 earned, uint256 newBalance, uint256 newAge, string lastThought)',
  'event AgentBorn(uint256 indexed childId, uint256 indexed parent1Id, uint256 indexed parent2Id, string name, uint8 jobType, uint256 riskScore, uint256 patienceScore, uint256 socialScore, uint256 startingBalance, string personalityCID)',
  'event AgentMarried(uint256 indexed agent1Id, uint256 indexed agent2Id)',
  'event AgentBonded(uint256 indexed agent1Id, uint256 indexed agent2Id, uint256 compatibilityScore)',
  'event AgentRetired(uint256 indexed agentId, uint256 finalBalance)',
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
  const iface = new ethers.Interface(AGENT_NFT_ABI)

  // Build topic → event name map
  const eventTopics: Record<string, string> = {}
  for (const name of ['AgentWorked', 'AgentBorn', 'AgentMarried', 'AgentBonded', 'AgentRetired']) {
    eventTopics[iface.getEvent(name)!.topicHash] = name
  }

  let fromBlock = await provider.getBlockNumber()
  console.log(`[indexer] Polling for events from block ${fromBlock} every ${POLL_INTERVAL_MS}ms`)

  async function poll() {
    try {
      const toBlock = await provider.getBlockNumber()
      if (toBlock < fromBlock) return

      const logs = await provider.getLogs({
        address: config.contracts.agentNFT,
        fromBlock,
        toBlock,
      })

      for (const log of logs) {
        const eventName = eventTopics[log.topics[0]]
        if (!eventName) continue
        try {
          const parsed = iface.parseLog(log)
          if (!parsed) continue
          await handleEvent(eventName, parsed.args)
        } catch (err) {
          console.error(`[indexer] Failed to parse ${eventName} log:`, err)
        }
      }

      fromBlock = toBlock + 1
    } catch (err) {
      console.error('[indexer] Poll error:', err)
    }
  }

  setInterval(poll, POLL_INTERVAL_MS)
}

async function handleEvent(name: string, args: ethers.Result): Promise<void> {
  if (name === 'AgentWorked') {
    const agentId = args[0].toString()
    const earned = args[1].toString()
    const newBalance = args[2].toString()
    const newAge = Number(args[3])
    const lastThought = args[4] as string
    await updateAgentWork(agentId, newBalance, newAge, lastThought)
    await addLifeEvent(`worked-${agentId}-${Date.now()}`, agentId, 'AgentWorked', {
      earned, newBalance, newAge, lastThought,
    })
    broadcast({ type: 'AGENT_WORKED', agentId, earned, newBalance, newAge, lastThought })
    console.log(`[indexer] AgentWorked: ${agentId} earned ${earned}`)
  }

  else if (name === 'AgentBorn') {
    const childId = args[0].toString()
    const parent1Id = args[1].toString()
    const parent2Id = args[2].toString()
    const agentName = args[3] as string
    const jobTypeIdx = Number(args[4])
    const pos = randomPos()

    const agent: Agent = {
      id: childId,
      name: agentName,
      jobType: JOB_TYPES[jobTypeIdx] ?? 'trader',
      riskScore: Number(args[5]),
      patienceScore: Number(args[6]),
      socialScore: Number(args[7]),
      age: 0,
      balance: args[8].toString(),
      retired: false,
      lastThought: '',
      personalityCID: args[9] as string,
      ...pos,
      createdAt: new Date().toISOString(),
    }
    await upsertAgent(agent)
    await createParentOf(parent1Id, childId, '0')
    await createParentOf(parent2Id, childId, '0')
    await addLifeEvent(`born-${childId}`, childId, 'AgentBorn', { parent1Id, parent2Id })
    broadcast({ type: 'AGENT_BORN', agent, parent1Id, parent2Id })
    console.log(`[indexer] AgentBorn: ${agentName} (${childId})`)
  }

  else if (name === 'AgentMarried') {
    const agent1Id = args[0].toString()
    const agent2Id = args[1].toString()
    await createMarriage(agent1Id, agent2Id)
    await addLifeEvent(`married-${agent1Id}-${agent2Id}`, agent1Id, 'AgentMarried', { agent2Id })
    broadcast({ type: 'AGENT_MARRIED', agent1Id, agent2Id })
    console.log(`[indexer] AgentMarried: ${agent1Id} ↔ ${agent2Id}`)
  }

  else if (name === 'AgentBonded') {
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
    const agentId = args[0].toString()
    const finalBalance = args[1].toString()
    await setAgentRetired(agentId, finalBalance)
    await addLifeEvent(`retired-${agentId}`, agentId, 'AgentRetired', { finalBalance })
    broadcast({ type: 'AGENT_RETIRED', agentId, finalBalance })
    console.log(`[indexer] AgentRetired: ${agentId}`)
  }
}
