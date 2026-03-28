import { Agent, Relationship } from '@/types/agent'

export function drawRelationships(
  ctx: CanvasRenderingContext2D,
  agents: Record<string, Agent>,
  relationships: Relationship[]
): void {
  for (const rel of relationships) {
    const a = agents[rel.from]
    const b = agents[rel.to]
    if (!a || !b) continue

    if (rel.type === 'BONDING_WITH') {
      drawBondingLine(ctx, a, b, rel.compatibilityScore ?? 0)
    } else if (rel.type === 'MARRIED_TO') {
      // Only draw once per pair (avoid duplicate lines)
      if (rel.from < rel.to) {
        drawMarriedLine(ctx, a, b)
      }
    }
  }
}

function drawBondingLine(
  ctx: CanvasRenderingContext2D,
  a: Agent,
  b: Agent,
  score: number
): void {
  ctx.save()
  ctx.strokeStyle = `rgba(148,163,184,${0.15 + score / 300})`
  ctx.lineWidth = 1
  ctx.setLineDash([5, 8])
  ctx.beginPath()
  ctx.moveTo(a.posX, a.posY)
  ctx.lineTo(b.posX, b.posY)
  ctx.stroke()
  ctx.setLineDash([])

  // Compatibility % at midpoint
  const mx = (a.posX + b.posX) / 2
  const my = (a.posY + b.posY) / 2
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(148,163,184,0.7)'
  ctx.fillText(`${score}%`, mx, my - 4)
  ctx.restore()
}

function drawMarriedLine(
  ctx: CanvasRenderingContext2D,
  a: Agent,
  b: Agent
): void {
  ctx.save()
  ctx.strokeStyle = '#f472b6'
  ctx.lineWidth = 2
  ctx.shadowColor = '#f472b6'
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.moveTo(a.posX, a.posY)
  ctx.lineTo(b.posX, b.posY)
  ctx.stroke()
  ctx.restore()

  // Heart at midpoint
  const mx = (a.posX + b.posX) / 2
  const my = (a.posY + b.posY) / 2
  drawHeart(ctx, mx, my, 6)
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save()
  ctx.fillStyle = '#f472b6'
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.3)
  ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.2)
  ctx.bezierCurveTo(x - size, y + size * 0.7, x, y + size * 1.1, x, y + size * 1.1)
  ctx.bezierCurveTo(x, y + size * 1.1, x + size, y + size * 0.7, x + size, y + size * 0.2)
  ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
