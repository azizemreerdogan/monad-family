export interface Particle {
  type: 'pulse' | 'birthGlow'
  x: number
  y: number
  radius: number
  maxRadius: number
  opacity: number
  duration: number
  elapsed: number
}

export function addPulse(particles: Particle[], x: number, y: number): void {
  particles.push({
    type: 'pulse',
    x,
    y,
    radius: 0,
    maxRadius: 60,
    opacity: 1,
    duration: 800,
    elapsed: 0,
  })
}

export function addBirthGlow(particles: Particle[], x: number, y: number): void {
  particles.push({
    type: 'birthGlow',
    x,
    y,
    radius: 40,
    maxRadius: 40,
    opacity: 0.8,
    duration: 3000,
    elapsed: 0,
  })
}

export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  deltaTime: number
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.elapsed += deltaTime

    const progress = Math.min(p.elapsed / p.duration, 1)

    if (p.type === 'pulse') {
      p.radius = p.maxRadius * progress
      p.opacity = 1 - progress

      ctx.save()
      ctx.strokeStyle = `rgba(167, 243, 208, ${p.opacity})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    } else if (p.type === 'birthGlow') {
      p.opacity = 0.8 * (1 - progress)

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
      grad.addColorStop(0, `rgba(255, 215, 0, ${p.opacity})`)
      grad.addColorStop(1, `rgba(255, 215, 0, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    if (p.elapsed >= p.duration) {
      particles.splice(i, 1)
    }
  }
}
