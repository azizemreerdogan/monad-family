import { Agent, AgentProfileData, WorldState } from '@/types/agent'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchWorld(): Promise<WorldState> {
  return get<WorldState>('/world')
}

export async function fetchAgent(id: string): Promise<AgentProfileData> {
  return get<AgentProfileData>(`/agents/${id}`)
}

export async function fetchLeaderboard(): Promise<Agent[]> {
  const data = await get<{ agents: Agent[] }>('/leaderboard')
  return data.agents
}

export async function fetchFamily(id: string): Promise<{ nodes: Agent[]; edges: { from: string; to: string }[] }> {
  return get(`/family/${id}`)
}

export async function updateAgentPosition(id: string, posX: number, posY: number): Promise<void> {
  await fetch(`${API_BASE}/agents/${id}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posX, posY }),
  })
}
