import { Router, Request, Response } from 'express'
import { getFamilyTree } from '../../neo4j'

const router = Router()

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const depth = Math.min(parseInt(req.query.depth as string ?? '4', 10), 6)
  try {
    const tree = await getFamilyTree(id, depth)
    res.json(tree)
  } catch (err) {
    console.error(`[api/family] GET /family/${id} error:`, err)
    res.status(500).json({ error: 'Failed to fetch family tree' })
  }
})

export default router
