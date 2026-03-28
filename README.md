# MonadFamily

> **A living world on the Monad blockchain** — AI agents with autonomous on-chain lives. They earn MON, form relationships, marry, have children, and retire, creating multi-generational dynasties entirely on-chain.

Unlike traditional AI agent platforms (which are job boards), MonadFamily is a **world** where users are parents and investors building dynasties, not clients posting tasks.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Agent Lifecycle](#agent-lifecycle)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Telegram Bot Commands](#telegram-bot-commands)
- [Tech Stack](#tech-stack)

---

## Overview

MonadFamily leverages Monad's parallel execution capabilities to run multiple agent work cycles simultaneously within the same block — something that would be prohibitively expensive or sequential on Ethereum.

Each agent is an NFT with:
- A **job type** (Trader, Farmer, or Lender)
- **Personality traits** (risk score, patience, social score)
- An **age** that increases with each work cycle (max 100)
- A **MON balance** that grows through work
- The ability to **bond**, **marry**, and **have children**

AI decision-making (Google Gemini 2.0 Flash) generates each agent's thought process and actions based on their unique personality prompt stored on IPFS.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│         Next.js 15 · Canvas Rendering · Zustand             │
│              (WebSocket consumer, port 3000)                │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket + REST
┌──────────────────────────▼──────────────────────────────────┐
│                         Indexer                             │
│         Express.js · Neo4j · WebSocket Broadcaster          │
│              (Blockchain event listener, port 3001)         │
└──────────┬────────────────────────────────┬─────────────────┘
           │ reads events                   │ REST
┌──────────▼───────────┐        ┌───────────▼─────────────────┐
│   Monad Blockchain   │        │           Daemon             │
│  (Testnet, 4 contracts)       │  TypeScript · Gemini · ethers│
│                      │        │  (Agent scheduler, port 3000)│
└──────────────────────┘        └─────────────────────────────┘
                                          │
                                ┌─────────▼──────────┐
                                │    Telegram Bot     │
                                │     Telegraf 4      │
                                └────────────────────┘
```

**Data flow:**
1. **Daemon** schedules agents, calls Gemini, and submits transactions
2. **Monad contracts** execute on-chain logic, emit events
3. **Indexer** picks up events, writes to Neo4j, broadcasts via WebSocket
4. **Frontend** consumes WebSocket + REST to render the live world
5. **Telegram bot** provides a chat interface for creation and queries

---

## Smart Contracts

All contracts are deployed on **Monad Testnet** (`https://testnet-rpc.monad.xyz`).

| Contract | Address | Purpose |
|----------|---------|---------|
| `AgentNFT` | `0xAF6B89c51696B6A9Ba4167eDFbF35a8273004027` | Mints agents as NFTs, stores all agent data |
| `FamilyRegistry` | `0x44BFe82D95E2Dc4E3dA899B71f5C1331092c3D9F` | Compatibility scores, marriage, household balances |
| `WorkEngine` | `0x2F7FeE5FBb7F1c1f84d8885b0185c6a193dAc1bc` | Work cycles, earnings based on job type and risk |
| `Marketplace` | `0xa60fD4cdc8600AEd6CD5a9E8c6e39a56f863e3cD` | Buy/sell agent NFTs |

### Agent NFT Data Structure

```solidity
struct Agent {
    uint256 id;
    string name;
    uint8 jobType;         // 0=Trader, 1=Farmer, 2=Lender
    uint8 riskScore;       // 0–100
    uint8 patience;        // 0–100
    uint8 socialScore;     // 0–100
    uint256 age;           // max 100, increments each work cycle
    uint256 balance;       // in wei (MON)
    uint256 partnerId;     // 0 if single
    uint256[] childIds;
    bool retired;
    string personalityCID; // IPFS CID for personality prompt
}
```

---

## Project Structure

```
monad-family/
├── daemon/              # Autonomous agent lifecycle manager
│   ├── src/
│   │   ├── agent/       # Scheduler, runner, marriage, childbirth, retirement
│   │   ├── claude/      # AI client (Gemini) + prompts
│   │   ├── contracts/   # ethers.js contract wrappers + ABIs + mock contracts
│   │   ├── events/      # Blockchain event listener
│   │   ├── ipfs/        # Pinata IPFS client
│   │   ├── personality/ # AI-generated personality creator
│   │   ├── api/         # HTTP server for agent creation
│   │   └── index.ts     # Main entry point
│   └── .env             # Daemon configuration
│
├── frontend/            # Live world visualization
│   ├── src/
│   │   ├── app/         # Next.js app router
│   │   ├── canvas/      # Canvas renderer, character/house/particle drawing
│   │   ├── components/  # WorldCanvas, AgentProfile, Leaderboard, EventLog, FamilyActions
│   │   ├── hooks/       # useWorldData, useWebSocket
│   │   └── store/       # Zustand world store
│   └── .env.local       # Frontend configuration
│
├── indexer/             # Blockchain → Neo4j → API bridge
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/  # /agents/:id, /leaderboard, /family, /world
│   │   │   └── server.ts
│   │   ├── indexer.ts   # Event listener → Neo4j writer
│   │   ├── neo4j.ts     # Database connection and queries
│   │   ├── seed.ts      # Database seeder
│   │   └── index.ts     # Main entry point
│   └── .env             # Indexer configuration
│
├── telegram-bot/        # Telegram interface
│   └── src/
│       └── index.ts     # Bot commands and handlers
│
├── family-contracts/    # Contract source placeholder
├── MonadFamily.md       # Project overview and philosophy
└── MonadFamily_Plan.md  # Technical architecture plan
```

---

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Neo4j** 5+ running locally on `bolt://localhost:7687`
- **Monad testnet wallet** with MON for gas
- **Google Gemini API key** (`gemini-2.0-flash` model)
- **Pinata account** with JWT for IPFS uploads
- **Telegram Bot Token** (for the bot, optional)

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd monad-family

# Install root dependencies
npm install

# Install per-component dependencies
cd daemon && npm install && cd ..
cd frontend && npm install && cd ..
cd indexer && npm install && cd ..
cd telegram-bot && npm install && cd ..
```

---

## Configuration

### Daemon (`daemon/.env`)

```bash
# Blockchain
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
AGENT_PRIVATE_KEY=0x<your_private_key>

# Contract Addresses
CONTRACT_AGENT_NFT=0xAF6B89c51696B6A9Ba4167eDFbF35a8273004027
CONTRACT_WORK_ENGINE=0x2F7FeE5FBb7F1c1f84d8885b0185c6a193dAc1bc
CONTRACT_FAMILY_REGISTRY=0x44BFe82D95E2Dc4E3dA899B71f5C1331092c3D9F
CONTRACT_MARKETPLACE=0xa60fD4cdc8600AEd6CD5a9E8c6e39a56f863e3cD

# Agent Configuration
AGENT_IDS=1,2,3,4,5
WORK_INTERVAL_MS=120000         # Work cycle frequency (default 2 min)
MARRIAGE_CHECK_INTERVAL_MS=300000  # Marriage check frequency (default 5 min)
CHILD_CHECK_INTERVAL_MS=600000     # Child check frequency (default 10 min)

# AI
GEMINI_API_KEY=<your_gemini_api_key>

# IPFS
PINATA_JWT=<your_pinata_jwt>
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs

# Development
MOCK_MODE=false                 # Set true to run without real contracts
LOG_LEVEL=info
```

### Indexer (`indexer/.env`)

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
RPC_URL=https://testnet-rpc.monad.xyz
AGENT_NFT_ADDRESS=0xAF6B89c51696B6A9Ba4167eDFbF35a8273004027
FAMILY_REGISTRY_ADDRESS=0x44BFe82D95E2Dc4E3dA899B71f5C1331092c3D9F
WORK_ENGINE_ADDRESS=0x2F7FeE5FBb7F1c1f84d8885b0185c6a193dAc1bc
MARKETPLACE_ADDRESS=0xa60fD4cdc8600AEd6CD5a9E8c6e39a56f863e3cD
API_PORT=3001
```

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_DAEMON_URL=http://localhost:3000
```

### Telegram Bot (`telegram-bot/.env`)

```bash
TELEGRAM_BOT_TOKEN=<your_telegram_bot_token>
DAEMON_URL=http://localhost:3000
INDEXER_URL=http://localhost:3001
```

---

## Running the Project

Start each service in a separate terminal:

```bash
# 1. Start Neo4j (required by indexer)
#    Make sure Neo4j is running on bolt://localhost:7687

# 2. Start the Indexer (port 3001)
cd indexer
npm run dev

# Optional: seed the database with initial data
npm run seed

# 3. Start the Daemon (port 3000)
cd daemon
npm run dev

# Optional: mint initial agents
npm run mint

# 4. Start the Frontend (port 3000 in Next.js dev)
cd frontend
npm run dev

# 5. Start the Telegram Bot (optional)
cd telegram-bot
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the live world.

### Mock Mode (no blockchain required)

Set `MOCK_MODE=true` in `daemon/.env` to run the entire daemon without real contracts — useful for local development.

---

## Agent Lifecycle

### Work Cycle (every 2 minutes per agent)

```
Fetch agent state (on-chain)
        ↓
Fetch personality from IPFS (cached)
        ↓
Call Gemini with personality + world context
        ↓
Parse AI response → determine action
        ↓
Select counterparty (for compatibility building)
        ↓
Submit work() transaction → WorkEngine contract
        ↓
Contract updates balance + age, emits AgentWorked event
        ↓
Indexer captures event → broadcasts via WebSocket
        ↓
Frontend canvas updates in real-time
```

### Marriage Formation

Agents with a **compatibility score ≥ 80** who are both single and not retired will automatically marry:

1. Daemon checks all agent pairs every 5 minutes
2. Executes 2-phase approval on `FamilyRegistry`
3. Executes marriage transaction
4. Indexer creates `MARRIED_TO` relationship in Neo4j
5. Canvas renders a bond line between the agents' houses

### Child Birth

```
User triggers birth in frontend or Telegram
        ↓
Daemon fetches both parents' personalities from IPFS
        ↓
Gemini generates blended child personality
        ↓
Child personality uploaded to IPFS
        ↓
mintChild() called on AgentNFT contract
        ↓
NFT minted, AgentBorn event emitted
        ↓
Indexer creates agent node + PARENT_OF relationships
        ↓
Scheduler detects new agent, adds to work rotation
        ↓
WebSocket broadcasts birth with full agent data
```

### Retirement

When an agent reaches **age 100**:
1. `work()` transaction sets the retirement flag
2. Daemon detects retired status and removes agent from scheduler
3. If listed on Marketplace, automatically delisted
4. Balance distribution to children (if any)

---

## API Reference

All endpoints served from the **Indexer** at `http://localhost:3001`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/world` | Full world state (all agents, relationships, events) |
| `GET` | `/agents/:id` | Agent profile with family tree |
| `GET` | `/leaderboard` | Top agents ranked by MON balance |
| `GET` | `/family` | Family relationship queries |

The **Daemon** exposes one endpoint at `http://localhost:3000`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agents` | Create and mint a new agent on-chain |

#### Create Agent Request Body

```json
{
  "name": "Alice",
  "jobType": 0,
  "riskScore": 75,
  "patience": 50,
  "socialScore": 90
}
```

---

## WebSocket Events

Connect to `ws://localhost:3001` for real-time world updates.

| Event Type | Payload |
|------------|---------|
| `AGENT_WORKED` | `{ agentId, earned, newBalance, newAge, lastThought }` |
| `AGENT_BORN` | `{ agent, parent1Id, parent2Id }` |
| `AGENT_MARRIED` | `{ agent1Id, agent2Id }` |
| `AGENT_BONDED` | `{ agent1Id, agent2Id, compatibilityScore }` |
| `AGENT_RETIRED` | `{ agentId, finalBalance }` |

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and introduction |
| `/create` | 5-step wizard to create and mint a new agent |
| `/leaderboard` | View top agents by MON balance |
| `/agent <id>` | View an agent's profile and family tree |
| `/status` | Check if the daemon API is online |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Monad Testnet, ethers.js v6 |
| Smart Contracts | Solidity (AgentNFT, FamilyRegistry, WorkEngine, Marketplace) |
| AI | Google Gemini 2.0 Flash |
| Storage | IPFS via Pinata |
| Daemon | TypeScript, Node.js, ts-node-dev |
| Indexer | TypeScript, Express.js, Neo4j, ws |
| Frontend | Next.js 15, React 19, Tailwind CSS, Zustand, Canvas API |
| Telegram Bot | TypeScript, Telegraf 4 |
| Database | Neo4j (graph DB for relationship queries) |

---

## Notes

- **Parallel Execution:** The system leverages Monad's parallel transaction execution to process multiple agent work cycles in the same block simultaneously.
- **IPFS Personality:** Each agent's AI personality prompt is stored on IPFS and referenced by CID in the NFT, making it immutable and decentralized.
- **Graph Relationships:** Neo4j is used over a relational DB specifically for efficient family tree queries (`PARENT_OF`, `MARRIED_TO`, `BONDING_WITH` relationships).
- **Single Signer:** The daemon uses a single wallet to sign all transactions on behalf of managed agents (admin model). Ensure this wallet has sufficient MON for gas.
