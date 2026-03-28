'use client'
import { useEffect } from 'react'
import { useWorldStore } from '@/store/worldStore'
import { fetchWorld } from '@/lib/api'

export function useWorldData() {
  const loadWorld = useWorldStore((s) => s.loadWorld)

  useEffect(() => {
    fetchWorld()
      .then(loadWorld)
      .catch((err) => console.error('[useWorldData] Failed to load world:', err))
  }, [loadWorld])
}
