import { Router, Request, Response } from 'express'
import { getAllAgents, getAllRelationships, updateAgentPosition } from '../../neo4j'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [agents, rels] = await Promise.all([getAllAgents(), getAllRelationships()])
    const relationships = rels.map((r) => ({
      type: r.type,
      from: r.from,
      to: r.to,
      ...(r.type === 'BONDING_WITH' ? { compatibilityScore: Number(r.properties.compatibilityScore ?? 0) } : {}),
      data: r.properties,
    }))
    res.json({ agents, relationships })
  } catch (err) {
    console.error('[api/world] GET /world error:', err)
    res.status(500).json({ error: 'Failed to fetch world state' })
  }
})

router.put('/agents/:id/position', async (req: Request, res: Response) => {
  const { id } = req.params
  const { posX, posY } = req.body as { posX: number; posY: number }
  if (typeof posX !== 'number' || typeof posY !== 'number') {
    res.status(400).json({ error: 'posX and posY must be numbers' })
    return
  }
  try {
    await updateAgentPosition(id, posX, posY)
    res.json({ ok: true })
  } catch (err) {
    console.error('[api/world] PUT /agents/:id/position error:', err)
    res.status(500).json({ error: 'Failed to update position' })
  }
})

export default router
