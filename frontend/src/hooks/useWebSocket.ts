'use client'
import { useEffect, useRef } from 'react'
import { useWorldStore } from '@/store/worldStore'
import { Agent, LifeEvent } from '@/types/agent'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'
const RECONNECT_DELAY = 3000

type WsMessage =
  | { type: 'AGENT_WORKED'; agentId: string; earned: string; newBalance: string; newAge: number; lastThought: string }
  | { type: 'AGENT_BORN'; agent: Agent; parent1Id: string; parent2Id: string }
  | { type: 'AGENT_MARRIED'; agent1Id: string; agent2Id: string }
  | { type: 'AGENT_BONDED'; agent1Id: string; agent2Id: string; compatibilityScore: number }
  | { type: 'AGENT_RETIRED'; agentId: string; finalBalance: string }
  | { type: 'CONNECTED' }

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const store = useWorldStore()

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[ws] Connected')
      }

      ws.onmessage = (event) => {
        let msg: WsMessage
        try {
          msg = JSON.parse(event.data as string) as WsMessage
        } catch {
          return
        }

        if (msg.type === 'CONNECTED') return

        if (msg.type === 'AGENT_WORKED') {
          store.updateAgent(msg.agentId, {
            balance: msg.newBalance,
            age: msg.newAge,
            lastThought: msg.lastThought,
          })
          store.triggerPulse(msg.agentId)
          store.addEvent({
            type: 'AgentWorked',
            agentId: msg.agentId,
            data: { earned: msg.earned, newBalance: msg.newBalance },
            timestamp: new Date().toISOString(),
          } as LifeEvent)
        }

        if (msg.type === 'AGENT_BORN') {
          store.addAgent(msg.agent)
          store.triggerBirthGlow(msg.agent.id)
          store.addRelationship({ type: 'PARENT_OF', from: msg.parent1Id, to: msg.agent.id })
          store.addRelationship({ type: 'PARENT_OF', from: msg.parent2Id, to: msg.agent.id })
          const parent1 = store.agents[msg.parent1Id]
          const parent2 = store.agents[msg.parent2Id]
          store.addEvent({
            type: 'AgentBorn',
            agentId: msg.agent.id,
            data: {
              name: msg.agent.name,
              parent1Name: parent1?.name ?? msg.parent1Id,
              parent2Name: parent2?.name ?? msg.parent2Id,
            },
            timestamp: new Date().toISOString(),
          } as LifeEvent)
        }

        if (msg.type === 'AGENT_MARRIED') {
          store.addRelationship({ type: 'MARRIED_TO', from: msg.agent1Id, to: msg.agent2Id })
          store.addRelationship({ type: 'MARRIED_TO', from: msg.agent2Id, to: msg.agent1Id })
          const a1 = store.agents[msg.agent1Id]
          const a2 = store.agents[msg.agent2Id]
          store.addEvent({
            type: 'AgentMarried',
            agentId: msg.agent1Id,
            data: { agent1Name: a1?.name ?? msg.agent1Id, agent2Name: a2?.name ?? msg.agent2Id },
            timestamp: new Date().toISOString(),
          } as LifeEvent)
        }

        if (msg.type === 'AGENT_BONDED') {
          store.addRelationship({
            type: 'BONDING_WITH',
            from: msg.agent1Id,
            to: msg.agent2Id,
            compatibilityScore: msg.compatibilityScore,
          })
          const a1 = store.agents[msg.agent1Id]
          const a2 = store.agents[msg.agent2Id]
          store.addEvent({
            type: 'AgentBonded',
            agentId: msg.agent1Id,
            data: { agent1Name: a1?.name, agent2Name: a2?.name, compatibilityScore: msg.compatibilityScore },
            timestamp: new Date().toISOString(),
          } as LifeEvent)
        }

        if (msg.type === 'AGENT_RETIRED') {
          store.updateAgent(msg.agentId, { retired: true, balance: msg.finalBalance })
          const agent = store.agents[msg.agentId]
          store.addEvent({
            type: 'AgentRetired',
            agentId: msg.agentId,
            data: { name: agent?.name, finalBalance: msg.finalBalance },
            timestamp: new Date().toISOString(),
          } as LifeEvent)
        }
      }

      ws.onclose = () => {
        console.log('[ws] Disconnected. Reconnecting...')
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = (err) => {
        console.error('[ws] Error:', err)
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
