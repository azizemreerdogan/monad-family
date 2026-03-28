export type JobType = 'trader' | 'farmer' | 'lender'

export interface Agent {
  id: string
  name: string
  jobType: JobType
  riskScore: number
  patienceScore: number
  socialScore: number
  age: number
  balance: string
  retired: boolean
  lastThought: string
  personalityCID: string
  posX: number
  posY: number
  createdAt: string
}

export interface Relationship {
  type: 'MARRIED_TO' | 'BONDING_WITH' | 'PARENT_OF'
  from: string
  to: string
  compatibilityScore?: number
  data?: Record<string, unknown>
}

export interface LifeEvent {
  id: string
  type: string
  agentId: string
  data: string
  timestamp: string
}

export interface AgentProfileResponse {
  agent: Agent
  family: {
    partner: Agent | null
    children: Agent[]
    parents: Agent[]
  }
  history: LifeEvent[]
  balanceHistory: { balance: string; age: number; timestamp: string }[]
}

export interface WorldState {
  agents: Agent[]
  relationships: Relationship[]
}

// WebSocket message types
export type WsMessage =
  | { type: 'AGENT_WORKED'; agentId: string; earned: string; newBalance: string; newAge: number; lastThought: string }
  | { type: 'AGENT_BORN'; agent: Agent; parent1Id: string; parent2Id: string }
  | { type: 'AGENT_MARRIED'; agent1Id: string; agent2Id: string }
  | { type: 'AGENT_BONDED'; agent1Id: string; agent2Id: string; compatibilityScore: number }
  | { type: 'AGENT_RETIRED'; agentId: string; finalBalance: string }
