'use client'
import { useEffect, useState } from 'react'
import { Agent, JOB_COLORS, formatMon } from '@/types/agent'
import { fetchLeaderboard } from '@/lib/api'
import { useWorldStore } from '@/store/worldStore'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Agent[]>([])
  const selectAgent = useWorldStore((s) => s.selectAgent)

  useEffect(() => {
    function load() {
      fetchLeaderboard()
        .then((agents) => setLeaders(agents.slice(0, 3)))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  if (leaders.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-20 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 min-w-44">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Leaderboard</p>
      <div className="space-y-2">
        {leaders.map((agent, i) => (
          <button
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className="w-full flex items-center gap-2 hover:bg-gray-800 rounded px-1 py-0.5 transition-colors text-left"
          >
            <span className="text-sm">{MEDALS[i]}</span>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: JOB_COLORS[agent.jobType] }}
            />
            <span className="text-gray-200 text-sm flex-1 truncate">{agent.name}</span>
            <span className="text-gray-400 text-xs">{formatMon(agent.balance, 2)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
