import { setupSchema } from './neo4j'
import { startIndexer, setBroadcast } from './indexer'
import { startServer, broadcast } from './api/server'

async function main() {
  console.log('[main] Starting MonadFamily indexer + API server...')

  // Connect Neo4j and apply schema
  await setupSchema()

  // Wire broadcast from indexer → WebSocket
  setBroadcast(broadcast)

  // Start Express + WebSocket server
  await startServer()

  // Start blockchain event listener
  await startIndexer()

  console.log('[main] All systems running.')
}

main().catch((err) => {
  console.error('[main] Fatal error:', err)
  process.exit(1)
})
