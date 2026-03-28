import { create } from 'zustand'
import { Agent, LifeEvent, Relationship, WorldState } from '@/types/agent'

interface WorldStore {
  agents: Record<string, Agent>
  relationships: Relationship[]
  events: LifeEvent[]
  selectedAgentId: string | null
  showFamilyActions: boolean
  pulsingAgents: Set<string>
  birthGlowAgents: Set<string>

  loadWorld: (data: WorldState) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  addAgent: (agent: Agent) => void
  addRelationship: (rel: Relationship) => void
  updateRelationship: (from: string, to: string, type: Relationship['type'], updates: Partial<Relationship>) => void
  addEvent: (event: LifeEvent) => void
  selectAgent: (id: string | null) => void
  setShowFamilyActions: (show: boolean) => void
  triggerPulse: (agentId: string) => void
  triggerBirthGlow: (agentId: string) => void
  updateAgentPosition: (id: string, x: number, y: number) => void
}

export const useWorldStore = create<WorldStore>((set) => ({
  agents: {},
  relationships: [],
  events: [],
  selectedAgentId: null,
  showFamilyActions: false,
  pulsingAgents: new Set(),
  birthGlowAgents: new Set(),

  loadWorld: (data) => {
    const agents: Record<string, Agent> = {}
    for (const agent of data.agents) agents[agent.id] = agent
    set({ agents, relationships: data.relationships })
  },

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: state.agents[id] ? { ...state.agents[id], ...updates } : state.agents[id],
      },
    })),

  addAgent: (agent) =>
    set((state) => ({ agents: { ...state.agents, [agent.id]: agent } })),

  addRelationship: (rel) =>
    set((state) => ({
      relationships: [
        ...state.relationships.filter(
          (r) => !(r.from === rel.from && r.to === rel.to && r.type === rel.type)
        ),
        rel,
      ],
    })),

  updateRelationship: (from, to, type, updates) =>
    set((state) => ({
      relationships: state.relationships.map((r) =>
        r.from === from && r.to === to && r.type === type ? { ...r, ...updates } : r
      ),
    })),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 20),
    })),

  selectAgent: (id) => set({ selectedAgentId: id }),

  setShowFamilyActions: (show) => set({ showFamilyActions: show }),

  triggerPulse: (agentId) => {
    set((state) => {
      const next = new Set(state.pulsingAgents)
      next.add(agentId)
      return { pulsingAgents: next }
    })
    setTimeout(() => {
      set((state) => {
        const next = new Set(state.pulsingAgents)
        next.delete(agentId)
        return { pulsingAgents: next }
      })
    }, 900)
  },

  triggerBirthGlow: (agentId) => {
    set((state) => {
      const next = new Set(state.birthGlowAgents)
      next.add(agentId)
      return { birthGlowAgents: next }
    })
    setTimeout(() => {
      set((state) => {
        const next = new Set(state.birthGlowAgents)
        next.delete(agentId)
        return { birthGlowAgents: next }
      })
    }, 3500)
  },

  updateAgentPosition: (id, x, y) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: state.agents[id] ? { ...state.agents[id], posX: x, posY: y } : state.agents[id],
      },
    })),
}))
