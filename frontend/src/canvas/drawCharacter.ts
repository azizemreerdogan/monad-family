import { Agent, JOB_COLORS, balanceToMon } from '@/types/agent'

export function drawCharacter(ctx: CanvasRenderingContext2D, agent: Agent, time: number): void {
  if (agent.retired) return

  const speed = 0.0003 + (agent.riskScore / 100) * 0.0008
  const angle = time * speed
  const orbitR = 28
  const x = agent.posX + Math.cos(angle) * orbitR
  const y = agent.posY + Math.sin(angle) * orbitR * 0.5

  // Bob
  const bob = Math.sin(time * speed * 6) * 1.5

  const color = JOB_COLORS[agent.jobType]
  const isHealthy = balanceToMon(agent.balance) > 0.5

  ctx.save()
  ctx.translate(x, y + bob)

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(0, 8, 5, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  const legSwing = Math.sin(time * speed * 8) * 3
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-1, 3)
  ctx.lineTo(-2 + legSwing, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(1, 3)
  ctx.lineTo(2 - legSwing, 8)
  ctx.stroke()

  // Body (shirt)
  ctx.fillStyle = color
  ctx.fillRect(-3, -4, 6, 7)

  // Arms
  const armSwing = Math.sin(time * speed * 8) * 4
  ctx.beginPath()
  ctx.moveTo(-3, -3)
  ctx.lineTo(-6, -3 + armSwing)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(3, -3)
  ctx.lineTo(6, -3 - armSwing)
  ctx.stroke()

  // Head
  ctx.fillStyle = '#fcd34d'
  ctx.beginPath()
  ctx.arc(0, -8, 4, 0, Math.PI * 2)
  ctx.fill()

  // Eyes
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(-2, -9, 1, 1)
  ctx.fillRect(1, -9, 1, 1)

  // Smile or neutral
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 0.8
  if (isHealthy) {
    ctx.beginPath()
    ctx.arc(0, -7, 1.5, 0.1, Math.PI - 0.1)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-1.5, -6.5)
    ctx.lineTo(1.5, -6.5)
    ctx.stroke()
  }

  ctx.restore()
}
