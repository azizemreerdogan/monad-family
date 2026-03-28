import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { config } from '../config'
import { WsMessage } from '../types'
import worldRouter from './routes/world'
import agentsRouter from './routes/agents'
import leaderboardRouter from './routes/leaderboard'
import familyRouter from './routes/family'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/world', worldRouter)
app.use('/agents', agentsRouter)
app.use('/leaderboard', leaderboardRouter)
app.use('/family', familyRouter)

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }))

const server = http.createServer(app)

// ─── WebSocket ────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server })
const clients = new Set<WebSocket>()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`[ws] Client connected. Total: ${clients.size}`)

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[ws] Client disconnected. Total: ${clients.size}`)
  })

  ws.on('error', (err) => {
    console.error('[ws] Client error:', err)
    clients.delete(ws)
  })

  // Send a welcome ping
  ws.send(JSON.stringify({ type: 'CONNECTED' }))
})

export function broadcast(msg: WsMessage): void {
  const payload = JSON.stringify(msg)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server.listen(config.api.port, () => {
      console.log(`[api] Server listening on http://localhost:${config.api.port}`)
      console.log(`[ws]  WebSocket listening on ws://localhost:${config.api.port}`)
      resolve()
    })
  })
}

export { server }
