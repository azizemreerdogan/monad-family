'use client'
import dynamic from 'next/dynamic'
import { useWorldData } from '@/hooks/useWorldData'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWorldStore } from '@/store/worldStore'
import EventLog from '@/components/EventLog'
import Leaderboard from '@/components/Leaderboard'
import AgentProfile from '@/components/AgentProfile'
import FamilyActions from '@/components/FamilyActions'

// WorldCanvas uses canvas + requestAnimationFrame — must be client-only
const WorldCanvas = dynamic(() => import('@/components/WorldCanvas'), { ssr: false })

export default function Home() {
  useWorldData()
  useWebSocket()

  const setShowFamilyActions = useWorldStore((s) => s.setShowFamilyActions)
  const showFamilyActions = useWorldStore((s) => s.showFamilyActions)

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Full-window canvas world */}
      <WorldCanvas />

      {/* Bottom-left event log */}
      <EventLog />

      {/* Top-right leaderboard */}
      <Leaderboard />

      {/* Agent profile slide-in */}
      <AgentProfile />

      {/* Family actions panel */}
      <FamilyActions />

      {/* Family Actions button */}
      {!showFamilyActions && (
        <button
          onClick={() => setShowFamilyActions(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-lg transition-colors"
        >
          Family Actions
        </button>
      )}
    </main>
  )
}
