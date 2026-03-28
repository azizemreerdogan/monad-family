import { Agent, JOB_COLORS, balanceToMon } from '@/types/agent'

function houseSize(agent: Agent): number {
  const mon = balanceToMon(agent.balance)
  if (mon < 1) return 28
  if (mon < 5) return 36
  if (mon < 15) return 44
  return 54
}

export function drawHouse(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  isSelected: boolean,
  hasBirthGlow: boolean,
  isMarried: boolean
): void {
  const { posX: cx, posY: cy } = agent
  const size = houseSize(agent)
  const color = agent.retired ? JOB_COLORS.retired : JOB_COLORS[agent.jobType]
  const half = size / 2
  const roofH = size * 0.55

  // Birth glow
  if (hasBirthGlow) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.4)
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.5)')
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, size * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Married pink dashed border
  if (isMarried && !agent.retired) {
    ctx.save()
    ctx.strokeStyle = '#f472b6'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.strokeRect(cx - half - 6, cy - half - 6, size + 12, size + 12)
    ctx.setLineDash([])
    ctx.restore()
  }

  // Selected glow
  if (isSelected) {
    ctx.save()
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 16
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(cx - half - 4, cy - half - 4, size + 8, size + 8)
    ctx.restore()
  }

  // House body
  ctx.fillStyle = color
  ctx.fillRect(cx - half, cy - half + roofH * 0.4, size, size * 0.65)

  // Roof
  ctx.fillStyle = shadeColor(color, -30)
  ctx.beginPath()
  ctx.moveTo(cx - half - 3, cy - half + roofH * 0.4)
  ctx.lineTo(cx, cy - half - roofH * 0.35)
  ctx.lineTo(cx + half + 3, cy - half + roofH * 0.4)
  ctx.closePath()
  ctx.fill()

  // Door
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  const doorW = size * 0.2
  const doorH = size * 0.3
  ctx.fillRect(cx - doorW / 2, cy - half + size * 0.65 - doorH + roofH * 0.4, doorW, doorH)

  // Window
  ctx.fillStyle = 'rgba(255,255,200,0.7)'
  const winS = size * 0.16
  ctx.fillRect(cx - half + size * 0.15, cy - half + size * 0.35 + roofH * 0.4, winS, winS)
  ctx.fillRect(cx + half - size * 0.15 - winS, cy - half + size * 0.35 + roofH * 0.4, winS, winS)

  // Job-specific decoration
  if (!agent.retired) {
    if (agent.jobType === 'trader') {
      // Arrow above roof
      ctx.fillStyle = '#fde68a'
      ctx.beginPath()
      ctx.moveTo(cx, cy - half - roofH * 0.35 - 10)
      ctx.lineTo(cx - 5, cy - half - roofH * 0.35 - 3)
      ctx.lineTo(cx + 5, cy - half - roofH * 0.35 - 3)
      ctx.closePath()
      ctx.fill()
    }

    if (agent.jobType === 'farmer') {
      // Small tree beside house
      const treeX = cx + half + 8
      const treeY = cy + half * 0.3
      const treeMon = balanceToMon(agent.balance)
      const treeH = 8 + Math.min(treeMon * 2, 16)
      ctx.fillStyle = '#166534'
      ctx.beginPath()
      ctx.arc(treeX, treeY - treeH * 0.5, treeH * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#92400e'
      ctx.fillRect(treeX - 2, treeY - treeH * 0.1, 4, treeH * 0.5)
    }

    if (agent.jobType === 'lender') {
      // Vault icon on wall
      const vx = cx - half + size * 0.65
      const vy = cy - half + size * 0.42 + roofH * 0.4
      const vr = size * 0.1
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(vx, vy, vr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(vx, vy)
      ctx.lineTo(vx, vy - vr)
      ctx.stroke()
    }
  }

  // Name tag
  ctx.font = `bold ${Math.max(10, size * 0.28)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillText(agent.name, cx + 1, cy + half + roofH * 0.4 + 14)
  ctx.fillStyle = '#f1f5f9'
  ctx.fillText(agent.name, cx, cy + half + roofH * 0.4 + 13)
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + percent))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent))
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent))
  return `rgb(${r},${g},${b})`
}
