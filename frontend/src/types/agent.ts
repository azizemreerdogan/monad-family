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
  id?: string
  type: string
  agentId: string
  data: Record<string, unknown>
  timestamp: string
}

export interface WorldState {
  agents: Agent[]
  relationships: Relationship[]
}

export interface AgentProfileData {
  agent: Agent
  family: {
    partner: Agent | null
    children: Agent[]
    parents: Agent[]
  }
  history: LifeEvent[]
  balanceHistory: { balance: string; age: number; timestamp: string }[]
}

export const JOB_COLORS: Record<JobType | 'retired', string> = {
  trader: '#7c3aed',
  farmer: '#16a34a',
  lender: '#d97706',
  retired: '#6b7280',
}

export function balanceToMon(wei: string): number {
  return parseFloat(wei) / 1e18
}

export function formatMon(wei: string, decimals = 4): string {
  return balanceToMon(wei).toFixed(decimals) + ' MON'
}
