'use client'
import { useState, useMemo } from 'react'
import { useWorldStore } from '@/store/worldStore'
import { Agent, formatMon } from '@/types/agent'

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL ?? 'http://localhost:3000'

export default function FamilyActions() {
  const show = useWorldStore((s) => s.showFamilyActions)
  const setShow = useWorldStore((s) => s.setShowFamilyActions)
  const agents = useWorldStore((s) => s.agents)
  const relationships = useWorldStore((s) => s.relationships)
  const [tab, setTab] = useState<'marry' | 'child'>('marry')

  if (!show) return null

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-30 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-t-xl w-[540px] p-5"
      style={{ animation: 'slideInUp 0.2s ease-out' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <TabBtn active={tab === 'marry'} onClick={() => setTab('marry')}>Marry</TabBtn>
          <TabBtn active={tab === 'child'} onClick={() => setTab('child')}>Have a Child</TabBtn>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-gray-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      {tab === 'marry' && (
        <MarryTab
          agents={Object.values(agents)}
          relationships={relationships}
        />
      )}
      {tab === 'child' && (
        <ChildTab
          agents={Object.values(agents)}
          relationships={relationships}
          daemonUrl={DAEMON_URL}
        />
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
        active ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function MarryTab({
  agents,
  relationships,
}: {
  agents: Agent[]
  relationships: { type: string; from: string; to: string; compatibilityScore?: number }[]
}) {
  const [id1, setId1] = useState('')
  const [id2, setId2] = useState('')
  const [status, setStatus] = useState('')

  const compat = useMemo(() => {
    if (!id1 || !id2) return null
    const rel = relationships.find(
      (r) =>
        r.type === 'BONDING_WITH' &&
        ((r.from === id1 && r.to === id2) || (r.from === id2 && r.to === id1))
    )
    return rel?.compatibilityScore ?? 0
  }, [id1, id2, relationships])

  const canMarry = compat !== null && compat >= 80

  async function handleMarry() {
    setStatus('Submitting...')
    try {
      const res = await fetch(`${DAEMON_URL}/marry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent1Id: id1, agent2Id: id2 }),
      })
      if (res.ok) setStatus('Marriage transaction submitted!')
      else setStatus('Failed to submit transaction.')
    } catch {
      setStatus('Error connecting to API.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AgentSelect agents={agents} value={id1} onChange={setId1} placeholder="Select agent 1" />
        <span className="text-gray-500">↔</span>
        <AgentSelect agents={agents} value={id2} onChange={setId2} placeholder="Select agent 2" />
      </div>

      {id1 && id2 && compat !== null && (
        <div className="bg-gray-800 rounded p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Compatibility</p>
          <p
            className="text-2xl font-bold"
            style={{ color: compat >= 80 ? '#34d399' : '#f59e0b' }}
          >
            {compat}%
          </p>
          {!canMarry && (
            <p className="text-gray-400 text-xs mt-1">
              Need {Math.ceil((80 - compat) / 5)} more interactions
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleMarry}
        disabled={!canMarry}
        className="w-full py-2 rounded font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-pink-600 hover:bg-pink-500 text-white"
      >
        Marry
      </button>
      {status && <p className="text-center text-sm text-gray-400">{status}</p>}
    </div>
  )
}

function ChildTab({
  agents,
  relationships,
  daemonUrl,
}: {
  agents: Agent[]
  relationships: { type: string; from: string; to: string }[]
  daemonUrl: string
}) {
  const marriedPairs = useMemo(() => {
    const seen = new Set<string>()
    const pairs: { a: Agent; b: Agent }[] = []
    for (const rel of relationships) {
      if (rel.type !== 'MARRIED_TO') continue
      const key = [rel.from, rel.to].sort().join('-')
      if (seen.has(key)) continue
      seen.add(key)
      const a = agents.find((x) => x.id === rel.from)
      const b = agents.find((x) => x.id === rel.to)
      if (a && b) pairs.push({ a, b })
    }
    return pairs
  }, [agents, relationships])

  const [pairIdx, setPairIdx] = useState(0)
  const [status, setStatus] = useState('')

  const pair = marriedPairs[pairIdx]

  const preview = useMemo(() => {
    if (!pair) return null
    const { a, b } = pair
    const rand = () => Math.round((Math.random() - 0.5) * 20)
    return {
      riskScore: Math.max(0, Math.min(100, Math.round((a.riskScore + b.riskScore) / 2) + rand())),
      patienceScore: Math.max(0, Math.min(100, Math.round((a.patienceScore + b.patienceScore) / 2) + rand())),
      socialScore: Math.max(0, Math.min(100, Math.round((a.socialScore + b.socialScore) / 2) + rand())),
      startingBalance: (
        (parseFloat(a.balance) * 0.1 + parseFloat(b.balance) * 0.1) /
        1e18
      ).toFixed(4),
    }
  }, [pair])

  async function handleSpawn() {
    if (!pair) return
    setStatus('Generating personality...')
    try {
      const res = await fetch(`${daemonUrl}/spawn-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent1Id: pair.a.id, parent2Id: pair.b.id }),
      })
      if (res.ok) setStatus('Child transaction submitted! Watch the world map.')
      else setStatus('Failed to spawn child.')
    } catch {
      setStatus('Error connecting to daemon.')
    }
  }

  if (marriedPairs.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-4">
        No married pairs yet. Marry two agents first.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-gray-400 text-sm">Pair:</p>
        <select
          value={pairIdx}
          onChange={(e) => setPairIdx(Number(e.target.value))}
          className="flex-1 bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1"
        >
          {marriedPairs.map((p, i) => (
            <option key={i} value={i}>
              {p.a.name} & {p.b.name}
            </option>
          ))}
        </select>
      </div>

      {preview && (
        <div className="bg-gray-800 rounded p-3 grid grid-cols-2 gap-2">
          <p className="col-span-2 text-gray-400 text-xs mb-1">Child preview (estimated)</p>
          <Stat label="Risk" value={`${preview.riskScore}/100`} />
          <Stat label="Patience" value={`${preview.patienceScore}/100`} />
          <Stat label="Social" value={`${preview.socialScore}/100`} />
          <Stat label="Starting balance" value={`${preview.startingBalance} MON`} />
        </div>
      )}

      <button
        onClick={handleSpawn}
        className="w-full py-2 rounded font-semibold text-sm bg-amber-600 hover:bg-amber-500 text-white transition-colors"
      >
        Confirm — Spawn Child
      </button>
      {status && <p className="text-center text-sm text-gray-400">{status}</p>}
    </div>
  )
}

function AgentSelect({
  agents,
  value,
  onChange,
  placeholder,
}: {
  agents: Agent[]
  value: string
  onChange: (id: string) => void
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1.5"
    >
      <option value="">{placeholder}</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-sm font-semibold">{value}</p>
    </div>
  )
}
