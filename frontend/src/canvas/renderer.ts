import { Agent, Relationship } from '@/types/agent'
import { drawHouse } from './drawHouse'
import { drawCharacter } from './drawCharacter'
import { drawRelationships } from './drawRelationships'
import {
  Particle,
  addPulse,
  addBirthGlow,
  updateAndDrawParticles,
} from './drawParticles'

interface RenderState {
  agents: Record<string, Agent>
  relationships: Relationship[]
  selectedAgentId: string | null
  pulsingAgents: Set<string>
  birthGlowAgents: Set<string>
}

let animFrameId = 0
let lastTime = 0
const particles: Particle[] = []
const seenPulses = new Set<string>()
const seenGlows = new Set<string>()

export function startRenderLoop(
  canvas: HTMLCanvasElement,
  getState: () => RenderState
): () => void {
  const ctx = canvas.getContext('2d')!

  function render(now: number) {
    const deltaTime = now - lastTime
    lastTime = now

    const state = getState()

    // Handle new pulses / glows
    for (const id of state.pulsingAgents) {
      if (!seenPulses.has(id)) {
        seenPulses.add(id)
        const agent = state.agents[id]
        if (agent) addPulse(particles, agent.posX, agent.posY)
      }
    }
    for (const id of seenPulses) {
      if (!state.pulsingAgents.has(id)) seenPulses.delete(id)
    }
    for (const id of state.birthGlowAgents) {
      if (!seenGlows.has(id)) {
        seenGlows.add(id)
        const agent = state.agents[id]
        if (agent) addBirthGlow(particles, agent.posX, agent.posY)
      }
    }
    for (const id of seenGlows) {
      if (!state.birthGlowAgents.has(id)) seenGlows.delete(id)
    }

    // ── Layer 1: Terrain ──────────────────────────────────────────────────────
    ctx.fillStyle = '#1a2e1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'
    ctx.lineWidth = 1
    const gridSize = 60
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Grass tufts (deterministic based on canvas size)
    ctx.fillStyle = '#22432266'
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.5) % canvas.width)
      const sy = ((i * 97.3) % canvas.height)
      ctx.fillRect(sx, sy, 2, 4)
      ctx.fillRect(sx + 3, sy + 1, 2, 3)
    }

    // ── Layer 2: Relationships ────────────────────────────────────────────────
    drawRelationships(ctx, state.agents, state.relationships)

    // ── Layer 3: Agents (painter's algorithm — sorted by Y) ───────────────────
    const agentList = Object.values(state.agents).sort((a, b) => a.posY - b.posY)
    const marriedIds = new Set(
      state.relationships.filter((r) => r.type === 'MARRIED_TO').map((r) => r.from)
    )

    for (const agent of agentList) {
      const isSelected = agent.id === state.selectedAgentId
      const hasBirthGlow = state.birthGlowAgents.has(agent.id)
      const isMarried = marriedIds.has(agent.id)
      drawHouse(ctx, agent, isSelected, hasBirthGlow, isMarried)
      drawCharacter(ctx, agent, now)
    }

    // ── Layer 4: Particles ────────────────────────────────────────────────────
    updateAndDrawParticles(ctx, particles, deltaTime)

    animFrameId = requestAnimationFrame(render)
  }

  animFrameId = requestAnimationFrame(render)

  return () => cancelAnimationFrame(animFrameId)
}
