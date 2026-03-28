'use client'
import { useEffect, useState } from 'react'
import { useWorldStore } from '@/store/worldStore'
import { AgentProfileData, JOB_COLORS, JobType, formatMon } from '@/types/agent'
import { fetchAgent } from '@/lib/api'

const JOB_LABELS: Record<JobType, string> = {
  trader: 'Trader',
  farmer: 'Farmer',
  lender: 'Lender',
}

export default function AgentProfile() {
  const selectedId = useWorldStore((s) => s.selectedAgentId)
  const selectAgent = useWorldStore((s) => s.selectAgent)
  const agents = useWorldStore((s) => s.agents)
  const [profile, setProfile] = useState<AgentProfileData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedId) { setProfile(null); return }
    setLoading(true)
    fetchAgent(selectedId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [selectedId])

  // Keep balance live from store
  const liveAgent = selectedId ? agents[selectedId] : null

  if (!selectedId) return null

  return (
    <div
      className="fixed right-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 overflow-y-auto z-30 flex flex-col"
      style={{ animation: 'slideInRight 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-700">
        <div>
          <h2 className="text-white font-bold text-lg">{liveAgent?.name ?? '...'}</h2>
          {liveAgent && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: JOB_COLORS[liveAgent.jobType] + '33',
                color: JOB_COLORS[liveAgent.jobType],
              }}
            >
              {JOB_LABELS[liveAgent.jobType]}
              {liveAgent.retired ? ' · Retired' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => selectAgent(null)}
          className="text-gray-400 hover:text-white text-xl leading-none mt-1"
        >
          ×
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Loading...
        </div>
      )}

      {!loading && liveAgent && (
        <div className="flex-1 p-4 space-y-5">
          {/* Last thought */}
          {liveAgent.lastThought && (
            <div className="bg-gray-800 rounded p-3">
              <p className="text-gray-400 text-xs mb-1">Current thought</p>
              <p className="text-gray-200 text-sm italic">"{liveAgent.lastThought}"</p>
            </div>
          )}

          {/* Stats */}
          <div>
            <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Stats</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Balance" value={formatMon(liveAgent.balance)} />
              <Stat label="Age" value={`${liveAgent.age} cycles`} />
              <Stat label="Risk" value={`${liveAgent.riskScore}/100`} />
              <Stat label="Patience" value={`${liveAgent.patienceScore}/100`} />
              <Stat label="Social" value={`${liveAgent.socialScore}/100`} />
            </div>
          </div>

          {/* Family */}
          {profile && (
            <div>
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Family</p>
              <div className="space-y-2">
                {profile.family.partner && (
                  <FamilyCard
                    label="Partner"
                    agent={profile.family.partner}
                    onSelect={() => selectAgent(profile.family.partner!.id)}
                  />
                )}
                {profile.family.parents.map((p) => (
                  <FamilyCard key={p.id} label="Parent" agent={p} onSelect={() => selectAgent(p.id)} />
                ))}
                {profile.family.children.map((c) => (
                  <FamilyCard key={c.id} label="Child" agent={c} onSelect={() => selectAgent(c.id)} />
                ))}
                {!profile.family.partner && profile.family.parents.length === 0 && profile.family.children.length === 0 && (
                  <p className="text-gray-500 text-sm">No family yet</p>
                )}
              </div>
            </div>
          )}

          {/* Balance chart */}
          {profile && profile.balanceHistory.length > 1 && (
            <div>
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Balance history</p>
              <BalanceChart history={profile.balanceHistory} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded p-2">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-sm font-semibold">{value}</p>
    </div>
  )
}

function FamilyCard({
  label,
  agent,
  onSelect,
}: {
  label: string
  agent: { id: string; name: string; jobType: JobType }
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded p-2 text-left transition-colors"
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: JOB_COLORS[agent.jobType] }}
      />
      <span className="text-gray-300 text-sm">{agent.name}</span>
      <span className="text-gray-500 text-xs ml-auto">{label}</span>
    </button>
  )
}

function BalanceChart({
  history,
}: {
  history: { balance: string; age: number; timestamp: string }[]
}) {
  const w = 272
  const h = 64
  const values = history.map((h) => parseFloat(h.balance) / 1e18)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 8) - 4
    return `${x},${y}`
  })

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill="rgba(124,58,237,0.15)"
        stroke="none"
      />
    </svg>
  )
}
