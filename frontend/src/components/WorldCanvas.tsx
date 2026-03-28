'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useWorldStore } from '@/store/worldStore'
import { startRenderLoop } from '@/canvas/renderer'
import { updateAgentPosition } from '@/lib/api'
import { Agent } from '@/types/agent'

const HOUSE_HIT_RADIUS = 32
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function hitTest(agents: Agent[], x: number, y: number): Agent | null {
  for (const agent of Object.values(agents).reverse()) {
    const dx = agent.posX - x
    const dy = agent.posY - y
    if (Math.sqrt(dx * dx + dy * dy) < HOUSE_HIT_RADIUS) return agent
  }
  return null
}

export default function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ agent: Agent; startX: number; startY: number } | null>(null)

  const selectAgent = useWorldStore((s) => s.selectAgent)
  const updatePos = useWorldStore((s) => s.updateAgentPosition)

  // Keep a stable ref to store state for the render loop
  const storeRef = useRef(useWorldStore.getState())
  useEffect(() => {
    return useWorldStore.subscribe((state) => { storeRef.current = state })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stop = startRenderLoop(canvas, () => storeRef.current)
    return () => {
      stop()
      window.removeEventListener('resize', resize)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const agents = storeRef.current.agents
    const hit = hitTest(Object.values(agents), e.clientX, e.clientY)
    if (hit) {
      dragRef.current = { agent: hit, startX: e.clientX, startY: e.clientY }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const { agent, startX, startY } = dragRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return

    const newX = agent.posX + (e.clientX - startX)
    const newY = agent.posY + (e.clientY - startY)
    updatePos(agent.id, newX, newY)
    dragRef.current = { ...dragRef.current, startX: e.clientX, startY: e.clientY }
    // Update the base agent position for continuous dragging
    dragRef.current.agent = { ...agent, posX: newX, posY: newY }

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      updateAgentPosition(agent.id, newX, newY)
    }, 500)
  }, [updatePos])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = dragRef.current &&
      (Math.abs(e.clientX - dragRef.current.startX) > 4 ||
       Math.abs(e.clientY - dragRef.current.startY) > 4)
    dragRef.current = null

    if (!wasDragging) {
      // It was a click
      const agents = storeRef.current.agents
      const hit = hitTest(Object.values(agents), e.clientX, e.clientY)
      selectAgent(hit ? hit.id : null)
    }
  }, [selectAgent])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ cursor: 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  )
}
