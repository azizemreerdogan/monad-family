import { Router, Request, Response } from 'express'
import { getAgentById, getAgentFamily, getAgentHistory, updateAgentPosition } from '../../neo4j'

const router = Router()

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const [agent, family, history] = await Promise.all([
      getAgentById(id),
      getAgentFamily(id),
      getAgentHistory(id),
    ])

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    // Build balance history from AgentWorked events
    const balanceHistory = history
      .filter((e) => e.type === 'AgentWorked')
      .map((e) => {
        let data: { newBalance?: string; newAge?: number } = {}
        try { data = JSON.parse(e.data) } catch {}
        return {
          balance: data.newBalance ?? agent.balance,
          age: data.newAge ?? agent.age,
          timestamp: e.timestamp,
        }
      })
      .reverse()

    res.json({ agent, family, history, balanceHistory })
  } catch (err) {
    console.error(`[api/agents] GET /agents/${id} error:`, err)
    res.status(500).json({ error: 'Failed to fetch agent' })
  }
})

router.put('/:id/position', async (req: Request, res: Response) => {
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
    console.error(`[api/agents] PUT /agents/${id}/position error:`, err)
    res.status(500).json({ error: 'Failed to update position' })
  }
})

export default router
