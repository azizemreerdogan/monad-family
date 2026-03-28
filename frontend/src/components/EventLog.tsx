'use client'
import { useShallow } from 'zustand/react/shallow'
import { useWorldStore } from '@/store/worldStore'
import { LifeEvent, formatMon } from '@/types/agent'

function formatEvent(event: LifeEvent): string {
  const d = event.data
  switch (event.type) {
    case 'AgentWorked':
      return `${d.name ?? 'Agent'} worked · +${formatMon(String(d.earned ?? '0'))}`
    case 'AgentBorn':
      return `${d.name ?? 'Agent'} was born — child of ${d.parent1Name ?? '?'} and ${d.parent2Name ?? '?'}`
    case 'AgentMarried':
      return `${d.agent1Name ?? '?'} and ${d.agent2Name ?? '?'} are married`
    case 'AgentBonded':
      return `${d.agent1Name ?? '?'} bonded with ${d.agent2Name ?? '?'} (${d.compatibilityScore}%)`
    case 'AgentRetired':
      return `${d.name ?? 'Agent'} retired at age 100`
    default:
      return event.type
  }
}

function eventColor(type: string): string {
  switch (type) {
    case 'AgentWorked': return '#34d399'
    case 'AgentBorn': return '#fbbf24'
    case 'AgentMarried': return '#f472b6'
    case 'AgentBonded': return '#60a5fa'
    case 'AgentRetired': return '#9ca3af'
    default: return '#e5e7eb'
  }
}

export default function EventLog() {
  const events = useWorldStore(useShallow((s) => s.events.slice(0, 5)))

  return (
    <div className="fixed bottom-4 left-4 z-20 space-y-1 max-w-xs pointer-events-none">
      {events.map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className="bg-gray-900/85 backdrop-blur-sm border border-gray-700 rounded px-3 py-1.5 text-xs"
          style={{
            borderLeftColor: eventColor(event.type),
            borderLeftWidth: 3,
            opacity: 1 - i * 0.15,
            animation: i === 0 ? 'fadeIn 0.3s ease-out' : undefined,
          }}
        >
          <span className="text-gray-200">{formatEvent(event)}</span>
        </div>
      ))}
      {events.length === 0 && (
        <div className="bg-gray-900/85 backdrop-blur-sm border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-500">
          Waiting for events...
        </div>
      )}
    </div>
  )
}
