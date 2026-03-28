import neo4j, { Driver, Session } from 'neo4j-driver'
import { config } from './config'
import { Agent, JobType } from './types'

let driver: Driver

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    )
  }
  return driver
}

export function getSession(): Session {
  return getDriver().session()
}

export async function closeDriver(): Promise<void> {
  if (driver) await driver.close()
}

export async function setupSchema(): Promise<void> {
  const session = getSession()
  try {
    // Constraints
    await session.run(`
      CREATE CONSTRAINT agent_id IF NOT EXISTS
      FOR (a:Agent) REQUIRE a.id IS UNIQUE
    `)
    await session.run(`
      CREATE CONSTRAINT event_id IF NOT EXISTS
      FOR (e:LifeEvent) REQUIRE e.id IS UNIQUE
    `)
    // Indexes
    await session.run(`
      CREATE INDEX agent_balance IF NOT EXISTS
      FOR (a:Agent) ON (a.balance)
    `)
    await session.run(`
      CREATE INDEX agent_retired IF NOT EXISTS
      FOR (a:Agent) ON (a.retired)
    `)
    console.log('[neo4j] Schema setup complete')
  } finally {
    await session.close()
  }
}

// ─── Agent writes ────────────────────────────────────────────────────────────

export async function upsertAgent(agent: Agent): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MERGE (a:Agent {id: $id})
       SET a.name = $name,
           a.jobType = $jobType,
           a.riskScore = $riskScore,
           a.patienceScore = $patienceScore,
           a.socialScore = $socialScore,
           a.age = $age,
           a.balance = $balance,
           a.retired = $retired,
           a.lastThought = $lastThought,
           a.personalityCID = $personalityCID,
           a.posX = $posX,
           a.posY = $posY,
           a.createdAt = $createdAt`,
      { ...agent }
    )
  } finally {
    await session.close()
  }
}

export async function updateAgentWork(
  agentId: string,
  newBalance: string,
  newAge: number,
  lastThought: string
): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a:Agent {id: $agentId})
       SET a.balance = $newBalance, a.age = $newAge, a.lastThought = $lastThought`,
      { agentId, newBalance, newAge, lastThought }
    )
  } finally {
    await session.close()
  }
}

export async function updateAgentPosition(
  agentId: string,
  posX: number,
  posY: number
): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a:Agent {id: $agentId}) SET a.posX = $posX, a.posY = $posY`,
      { agentId, posX, posY }
    )
  } finally {
    await session.close()
  }
}

export async function setAgentRetired(agentId: string, finalBalance: string): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a:Agent {id: $agentId}) SET a.retired = true, a.balance = $finalBalance`,
      { agentId, finalBalance }
    )
  } finally {
    await session.close()
  }
}

// ─── Relationship writes ──────────────────────────────────────────────────────

export async function createMarriage(agent1Id: string, agent2Id: string): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a1:Agent {id: $agent1Id}), (a2:Agent {id: $agent2Id})
       MERGE (a1)-[r1:MARRIED_TO]->(a2)
       SET r1.marriedAt = datetime(), r1.householdBalance = '0'
       MERGE (a2)-[r2:MARRIED_TO]->(a1)
       SET r2.marriedAt = datetime(), r2.householdBalance = '0'`,
      { agent1Id, agent2Id }
    )
  } finally {
    await session.close()
  }
}

export async function upsertBonding(
  agent1Id: string,
  agent2Id: string,
  compatibilityScore: number
): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a1:Agent {id: $agent1Id}), (a2:Agent {id: $agent2Id})
       MERGE (a1)-[r:BONDING_WITH]->(a2)
       SET r.compatibilityScore = $compatibilityScore, r.lastInteraction = datetime()`,
      { agent1Id, agent2Id, compatibilityScore }
    )
  } finally {
    await session.close()
  }
}

export async function createParentOf(
  parentId: string,
  childId: string,
  monadGiven: string
): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (p:Agent {id: $parentId}), (c:Agent {id: $childId})
       MERGE (p)-[r:PARENT_OF]->(c)
       SET r.monadGiven = $monadGiven, r.bornAt = datetime()`,
      { parentId, childId, monadGiven }
    )
  } finally {
    await session.close()
  }
}

// ─── Event writes ─────────────────────────────────────────────────────────────

export async function addLifeEvent(
  id: string,
  agentId: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `MATCH (a:Agent {id: $agentId})
       CREATE (e:LifeEvent {id: $id, type: $type, agentId: $agentId, data: $data, timestamp: datetime()})
       CREATE (a)-[:HAS_EVENT]->(e)`,
      { id, agentId, type, data: JSON.stringify(data) }
    )
  } finally {
    await session.close()
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAllAgents(): Promise<Agent[]> {
  const session = getSession()
  try {
    const result = await session.run(`MATCH (a:Agent) RETURN a ORDER BY a.createdAt`)
    return result.records.map((r) => toAgent(r.get('a').properties))
  } finally {
    await session.close()
  }
}

export async function getAllRelationships(): Promise<
  { type: string; from: string; to: string; properties: Record<string, unknown> }[]
> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (a)-[r:MARRIED_TO|BONDING_WITH|PARENT_OF]->(b)
      RETURN type(r) as type, a.id as from, b.id as to, properties(r) as props
    `)
    return result.records.map((r) => ({
      type: r.get('type') as string,
      from: r.get('from') as string,
      to: r.get('to') as string,
      properties: r.get('props') as Record<string, unknown>,
    }))
  } finally {
    await session.close()
  }
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const session = getSession()
  try {
    const result = await session.run(`MATCH (a:Agent {id: $id}) RETURN a`, { id })
    if (result.records.length === 0) return null
    return toAgent(result.records[0].get('a').properties)
  } finally {
    await session.close()
  }
}

export async function getAgentFamily(
  id: string
): Promise<{ partner: Agent | null; children: Agent[]; parents: Agent[] }> {
  const session = getSession()
  try {
    const [partnerRes, childrenRes, parentsRes] = await Promise.all([
      session.run(
        `MATCH (a:Agent {id: $id})-[:MARRIED_TO]->(p:Agent) RETURN p LIMIT 1`,
        { id }
      ),
      session.run(
        `MATCH (a:Agent {id: $id})-[:PARENT_OF]->(c:Agent) RETURN c`,
        { id }
      ),
      session.run(
        `MATCH (p:Agent)-[:PARENT_OF]->(a:Agent {id: $id}) RETURN p`,
        { id }
      ),
    ])
    return {
      partner: partnerRes.records.length > 0 ? toAgent(partnerRes.records[0].get('p').properties) : null,
      children: childrenRes.records.map((r) => toAgent(r.get('c').properties)),
      parents: parentsRes.records.map((r) => toAgent(r.get('p').properties)),
    }
  } finally {
    await session.close()
  }
}

export async function getAgentHistory(id: string): Promise<
  { id: string; type: string; agentId: string; data: string; timestamp: string }[]
> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (a:Agent {id: $id})-[:HAS_EVENT]->(e:LifeEvent)
       RETURN e ORDER BY e.timestamp DESC LIMIT 50`,
      { id }
    )
    return result.records.map((r) => {
      const p = r.get('e').properties
      return {
        id: p.id,
        type: p.type,
        agentId: p.agentId,
        data: p.data,
        timestamp: p.timestamp.toString(),
      }
    })
  } finally {
    await session.close()
  }
}

export async function getTopAgentsByBalance(limit = 10): Promise<Agent[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (a:Agent) WHERE a.retired = false
       RETURN a ORDER BY toFloat(a.balance) DESC LIMIT $limit`,
      { limit: neo4j.int(limit) }
    )
    return result.records.map((r) => toAgent(r.get('a').properties))
  } finally {
    await session.close()
  }
}

export async function getFamilyTree(
  id: string,
  depth = 4
): Promise<{ nodes: Agent[]; edges: { from: string; to: string }[] }> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH path = (root:Agent {id: $id})-[:PARENT_OF*0..${depth}]->(descendant)
       UNWIND nodes(path) as n
       WITH DISTINCT n
       MATCH (n)-[r:PARENT_OF]->(child) WHERE child IN nodes(path)
       RETURN DISTINCT n, r, child`,
      { id }
    )
    const nodesMap = new Map<string, Agent>()
    const edges: { from: string; to: string }[] = []
    for (const record of result.records) {
      const n = toAgent(record.get('n').properties)
      const child = toAgent(record.get('child').properties)
      nodesMap.set(n.id, n)
      nodesMap.set(child.id, child)
      edges.push({ from: n.id, to: child.id })
    }
    return { nodes: Array.from(nodesMap.values()), edges }
  } finally {
    await session.close()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAgent(p: Record<string, unknown>): Agent {
  return {
    id: String(p.id),
    name: String(p.name),
    jobType: String(p.jobType) as JobType,
    riskScore: Number(p.riskScore),
    patienceScore: Number(p.patienceScore),
    socialScore: Number(p.socialScore),
    age: Number(p.age),
    balance: String(p.balance ?? '0'),
    retired: Boolean(p.retired),
    lastThought: String(p.lastThought ?? ''),
    personalityCID: String(p.personalityCID ?? ''),
    posX: Number(p.posX ?? 0),
    posY: Number(p.posY ?? 0),
    createdAt: p.createdAt ? String(p.createdAt) : new Date().toISOString(),
  }
}
