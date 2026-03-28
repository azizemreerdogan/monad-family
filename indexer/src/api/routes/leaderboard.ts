import { Router, Request, Response } from 'express'
import { getTopAgentsByBalance } from '../../neo4j'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await getTopAgentsByBalance(10)
    res.json({ agents })
  } catch (err) {
    console.error('[api/leaderboard] GET /leaderboard error:', err)
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

export default router
