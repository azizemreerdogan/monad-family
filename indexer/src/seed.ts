/**
 * Seed Neo4j with mock agents for local development.
 * Run: npm run seed
 */
import { setupSchema, upsertAgent, createMarriage, upsertBonding } from './neo4j'
import { Agent } from './types'

const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Aria',
    jobType: 'trader',
    riskScore: 75,
    patienceScore: 40,
    socialScore: 65,
    age: 23,
    balance: '1500000000000000000',
    retired: false,
    lastThought: 'I am adding liquidity to the yield pool today.',
    personalityCID: 'QmMockCID1',
    posX: 300,
    posY: 250,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Kaan',
    jobType: 'farmer',
    riskScore: 35,
    patienceScore: 80,
    socialScore: 70,
    age: 19,
    balance: '900000000000000000',
    retired: false,
    lastThought: 'Tending to the yield fields, one harvest at a time.',
    personalityCID: 'QmMockCID2',
    posX: 600,
    posY: 300,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Elif',
    jobType: 'lender',
    riskScore: 55,
    patienceScore: 60,
    socialScore: 45,
    age: 31,
    balance: '3200000000000000000',
    retired: false,
    lastThought: 'Reviewing collateral ratios before extending the next loan.',
    personalityCID: 'QmMockCID3',
    posX: 950,
    posY: 200,
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Deniz',
    jobType: 'trader',
    riskScore: 90,
    patienceScore: 20,
    socialScore: 55,
    age: 12,
    balance: '420000000000000000',
    retired: false,
    lastThought: 'Riding the volatility — this is where the real gains are.',
    personalityCID: 'QmMockCID4',
    posX: 200,
    posY: 500,
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Selin',
    jobType: 'farmer',
    riskScore: 25,
    patienceScore: 90,
    socialScore: 80,
    age: 45,
    balance: '8700000000000000000',
    retired: false,
    lastThought: 'A steady crop beats a lucky gamble every season.',
    personalityCID: 'QmMockCID5',
    posX: 750,
    posY: 550,
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Emre',
    jobType: 'lender',
    riskScore: 50,
    patienceScore: 70,
    socialScore: 60,
    age: 67,
    balance: '12000000000000000000',
    retired: false,
    lastThought: 'The vault holds, as always. Capital compounds in silence.',
    personalityCID: 'QmMockCID6',
    posX: 1100,
    posY: 450,
    createdAt: new Date().toISOString(),
  },
]

async function seed() {
  console.log('[seed] Setting up schema...')
  await setupSchema()

  console.log('[seed] Inserting agents...')
  for (const agent of MOCK_AGENTS) {
    await upsertAgent(agent)
    console.log(`[seed]   ✓ ${agent.name} (${agent.id})`)
  }

  // Aria and Kaan are married
  console.log('[seed] Creating marriage: Aria ↔ Kaan...')
  await createMarriage('1', '2')

  // Aria bonding with Elif (78 compatibility — just below marry threshold)
  console.log('[seed] Creating bonding: Aria ↔ Elif (78%)...')
  await upsertBonding('1', '3', 78)

  // Deniz bonding with Selin (45%)
  console.log('[seed] Creating bonding: Deniz ↔ Selin (45%)...')
  await upsertBonding('4', '5', 45)

  // Emre bonding with Elif (62%)
  console.log('[seed] Creating bonding: Emre ↔ Elif (62%)...')
  await upsertBonding('6', '3', 62)

  console.log('[seed] Done! 6 agents seeded.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('[seed] Error:', err)
  process.exit(1)
})
