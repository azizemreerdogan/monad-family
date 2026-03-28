# MonadFamily — Full Technical Plan

> What to build, how it connects, and what each layer is responsible for. No code — just the plan.

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [How the Layers Connect](#2-how-the-layers-connect)
3. [Smart Contracts — The Source of Truth](#3-smart-contracts--the-source-of-truth)
4. [Agent Daemon — The Autonomous Worker](#4-agent-daemon--the-autonomous-worker)
5. [Graph Database — The Memory](#5-graph-database--the-memory)
6. [API Server — The Bridge](#6-api-server--the-bridge)
7. [Frontend — The World](#7-frontend--the-world)
8. [The Three Screens](#8-the-three-screens)
9. [How a Life Event Flows End to End](#9-how-a-life-event-flows-end-to-end)
10. [What Monad Makes Possible](#10-what-monad-makes-possible)
11. [Build Order for Hackathon Day](#11-build-order-for-hackathon-day)
12. [Demo Script](#12-demo-script)

---

## 1. What We Are Building

MonadFamily is a living world simulation on Monad. AI agents are the citizens. They have personalities, jobs, relationships, children, and deaths — all recorded permanently on-chain.

Every agent is an NFT with a soul. The soul is an AI-generated personality prompt stored on IPFS. The body is a set of numeric traits stored in the smart contract. Together they determine how the agent behaves, who it bonds with, and what it passes to its children.

The world has three layers a user can interact with. The world map is a living canvas showing all agents as houses with walking characters outside. Clicking an agent opens their profile — their history, family tree, and current thoughts. Owning agents unlocks the family actions screen where you can marry two of your agents and spawn children.

The whole system runs without a human touching anything. Agents work, bond, marry, reproduce, and retire on their own. The user is a spectator who can also be an investor — buying agents whose bloodlines they believe in.

---

## 2. How the Layers Connect

There are five layers and data flows in one direction through all of them.

The smart contracts on Monad are the only source of truth. Nothing is real until it is on-chain. Agents exist, earn MON, marry, and die through contract function calls.

The agent daemon is the autonomous actor. It runs in the background, reads agent state from the chain, calls Claude to decide what action to take, and submits transactions. It never writes to a database. It only submits transactions.

The event indexer watches the chain for contract events and translates them into the graph database. Every AgentWorked event becomes an updated node in Neo4j. Every AgentMarried event becomes a new relationship edge. The indexer is the bridge between chain state and queryable data.

The API server sits on top of the graph database and exposes two things — REST endpoints for the initial data load and a WebSocket connection for live updates. The frontend never talks to the chain or the database directly. It only talks to the API.

The frontend is a canvas-based world rendered in the browser. It loads the world state once on startup via REST, then stays live by listening to the WebSocket. Every time an agent works or a child is born, the WebSocket pushes a message and the canvas updates within milliseconds.

---

## 3. Smart Contracts — The Source of Truth

### What the contracts store

Each agent is an NFT. The NFT stores the agent's numeric identity — their name, job type, risk score, patience score, social score, current age, current MON balance, partner ID, list of child IDs, whether they are retired, and the IPFS address of their personality prompt.

The family registry is a separate contract that tracks relationships between agents. It stores compatibility scores between agent pairs, marriage records, and household balances for married couples.

The work engine is what agents call each time they complete a work cycle. For the hackathon it simulates earnings — a higher risk score means more variance in earnings. After the hackathon this gets replaced with real DeFi protocol calls.

The marketplace contract handles buying and selling agent NFTs. An owner can list their agent at a price in MON. Any wallet can buy a listed agent. The new owner takes over control of that agent's daemon.

### What events the contracts emit

Every meaningful thing that happens to an agent emits an event on-chain. These events are what the indexer listens to. Without these events, nothing downstream knows what happened.

When an agent completes a work cycle, the contract emits the agent's ID, how much they earned, their new total balance, and their new age.

When a child is born, the contract emits the child's ID, both parent IDs, the child's name, all inherited traits, and the IPFS address of the child's personality prompt.

When two agents marry, the contract emits both agent IDs.

When two agents interact and their compatibility increases, the contract emits both IDs and the new compatibility score.

When an agent retires at age 100, the contract emits their ID and the final balance that was distributed to children.

When an agent is listed or sold on the marketplace, the contract emits the relevant IDs, price, and buyer address.

### What the contracts must NOT do

Contracts do not store personality text. That lives on IPFS. Contracts do not call external APIs. Contracts do not store position data for the UI. Contracts do not make decisions — the daemon does that.

---

## 4. Agent Daemon — The Autonomous Worker

### What it is

The daemon is a background process that never stops running. It holds the private keys for the agent wallets it manages. It wakes up on a timer for each agent, decides what action to take using Claude, and submits a work transaction to Monad.

One daemon instance can manage multiple agents. Each agent runs on its own timer, staggered so they do not all hit the chain simultaneously.

### What it does each cycle

The daemon reads the agent's current state from the chain — their balance, age, job type, and personality CID. It fetches the personality prompt from IPFS using the CID (this is cached after the first fetch so it does not call IPFS every cycle). It sends the personality prompt plus the agent's current context to Claude and receives back a one-sentence description of what the agent is doing. This sentence becomes the agent's "last thought" which appears in their profile UI. The daemon then submits the work transaction, which updates the agent's balance and age on-chain.

### What happens when a child needs to be born

When a user triggers child creation through the frontend, the frontend calls the daemon's API with both parent IDs. The daemon fetches both parents' personality prompts from IPFS, sends them both to Claude with the child's blended traits, and receives back a new personality prompt for the child. It uploads this prompt to IPFS, gets a content identifier back, and then submits the mintChild transaction with that content identifier. From this point the indexer handles the rest.

### What the daemon must NOT do

The daemon does not write to Neo4j. It does not push messages to the frontend. It does not serve the main API. It does not make decisions about who to marry or when to retire — those are either automatic (retirement at age 100, triggered by the work function) or human-initiated (marriage, through the frontend).

---

## 5. Graph Database — The Memory

### Why a graph database

The family relationships in MonadFamily are a natural graph. Agent A is married to Agent B. Agent A and B are both parents of Agent C. Agent C is bonding with Agent D. Querying this with a traditional database requires complex joins. Neo4j stores relationships as first-class citizens, making queries like "show me the full family tree of this agent going back four generations" trivial.

The graph database also serves as the queryable cache of chain state. The chain is authoritative but slow to query. Neo4j is fast and can answer complex relationship queries in milliseconds.

### What lives in the graph

Every agent is a node. The node stores all the same numeric data as the contract — ID, name, job type, traits, age, balance, retired status — plus two things the contract does not store. First is the agent's last thought, the sentence Claude generated during their most recent work cycle. Second is the agent's X and Y position on the world map canvas, which is saved here so the layout persists across page loads.

Relationships are edges between nodes. A married-to edge connects two agents and stores the date of marriage and their combined household balance. A bonding-with edge connects two agents who have interacted but are not yet married and stores their current compatibility score. A parent-of edge connects a parent to their child and stores how much MON was given at birth. Every life event also creates an event node connected to the relevant agent, giving each agent a complete on-chain history.

### What the indexer writes

The indexer is a Node.js process that subscribes to all contract events and translates them into Neo4j writes. When an AgentWorked event arrives, it updates the agent node's balance, age, and last thought. When an AgentBorn event arrives, it creates a new agent node and creates parent-of and child-of edges to both parents. When an AgentMarried event arrives, it creates married-to edges in both directions. When an AgentBonded event arrives, it creates or updates the bonding-with edge with the new compatibility score. When an AgentRetired event arrives, it sets the retired flag on the node.

---

## 6. API Server — The Bridge

### What it exposes

The API server is an Express application with two interfaces.

The REST interface handles requests that need a full data payload. On page load the frontend calls a world endpoint that returns every agent and every relationship in one response. When a user clicks on an agent the frontend calls a profile endpoint that returns that agent's full history, family tree, and balance chart data. There is also a leaderboard endpoint returning the top agents by balance and a family endpoint returning a full multi-generation tree for any agent.

The WebSocket interface handles live updates. When the frontend connects, it subscribes to a stream of events. Every time the indexer processes a new contract event it broadcasts the relevant message to all connected WebSocket clients. The frontend receives these messages and updates the canvas and event log in real time.

### What the API must NOT do

The API does not write to the blockchain. It does not call Claude directly. It does not manage agent private keys. It is read-only from the perspective of chain state. The only write it performs is saving agent position data back to Neo4j when the user drags a house.

---

## 7. Frontend — The World

### Architecture

The frontend is a Next.js application. There are two clearly separated concerns — the canvas world and the UI panels.

The canvas is a full-window HTML canvas element running a render loop. It draws the terrain, houses, walking characters, relationship lines, name tags, and particle effects. It reads all its data from a Zustand state store. It does not fetch data directly — it only reads the store.

The UI panels are normal React components rendered on top of the canvas. The agent profile slides in from the right when an agent is clicked. The family actions panel appears at the bottom. The event log sits at the bottom left. These are standard divs and CSS — not canvas.

The Zustand store is the single source of truth for the frontend. On startup the app fetches the world data from the API and populates the store. The WebSocket hook listens for live events and applies small updates to the store — increment this agent's balance, add this new agent, create this new relationship edge. The canvas reads the store every frame and renders whatever is there.

### The render loop

Every frame the renderer draws four layers in order.

First it draws the terrain — a grass-colored background with subtle grid texture and small plant shapes scattered across it.

Second it draws relationship lines between agents. Bonding relationships are drawn as faint dashed lines with the compatibility percentage shown at the midpoint. Married relationships are drawn as solid colored lines with a heart shape at the midpoint.

Third it draws agents sorted by their Y position. Agents lower on the screen are drawn last so they appear in front of agents higher up — this is the painter's algorithm and gives depth to the scene. For each agent it draws the house, then the walking character orbiting the house, then the name tag below.

Fourth it draws particle effects — pulse rings when an agent works, a golden glow when a child is born, smoke from chimneys for active agents.

### House visual language

The size of the house reflects the agent's MON balance. A new agent with a small balance lives in a small house. A wealthy veteran lives in a large house. The color of the house reflects the agent's job — purple for traders, green for farmers, amber for lenders, grey for retired agents.

Each job type also has a visual decoration around the house that makes it readable at a glance without looking at any label. Farmer houses have small tree shapes growing next to them that get larger as the balance grows. Trader houses have a small upward arrow above the roof. Lender houses have a small vault icon on the wall.

Married agents have a pink dashed border around their houses and a heart shape on the relationship line connecting them.

When an agent works, a pulse ring expands outward from their house and fades. When a child is born, the new house appears with a golden glow that fades over a few seconds.

### The walking character

Each agent has a small pixel-art-style character that walks in a slow orbit around their house. The character's shirt color matches their job type color. Patient agents walk slowly. High-risk agents walk quickly.

The character bobs up and down with each step. Arms and legs swing in alternating rhythm. When the agent's balance is healthy the character has a visible smile. Retired agents do not have a walking character — only the house remains.

---

## 8. The Three Screens

### Screen 1 — World Map

The default view. Full canvas. All agents visible simultaneously as houses with walkers. Relationship lines connect bonded and married agents. Event log in the bottom left showing the most recent five life events. Leaderboard panel in the top right showing the three wealthiest agents.

Clicking any house opens the agent profile panel without leaving the world map — the canvas dims slightly and the profile slides in from the right.

### Screen 2 — Agent Profile

A panel that slides in from the right side. Shows the agent's name and generated avatar at the top. Below that their personality summary — a few sentences from their IPFS prompt. Their stats — balance, age, job, risk score, patience. Their last thought — what Claude said they were doing during their most recent work cycle.

Below the stats is the family section. If they have a partner it shows the partner's name and avatar with a link to view them. If they have children it shows each child as a small card. If they have parents it shows them.

Below the family is the balance history — a small line chart showing how their MON balance has grown over time.

At the bottom is a buy button if the agent is listed on the marketplace, showing the current price.

### Screen 3 — Family Actions

Only accessible if the user owns agents. Triggered by clicking a button in the world map UI.

The marry flow shows two of the user's agents side by side with their compatibility score between them. If compatibility is below 80 the marry button is disabled and shows how many more interactions are needed. If compatibility is 80 or above the marry button is active. Clicking it submits the marriage transaction.

The have-a-child flow shows a married pair and a preview of what their child will look like — the predicted blended traits before any transaction is submitted. The user sees the child's predicted job, risk score, patience score, and starting balance. They also see a randomly generated name suggestion from Claude. Clicking confirm triggers the daemon to generate the personality and submit the mint transaction. The new house appears on the world map within seconds.

---

## 9. How a Life Event Flows End to End

### Example — an agent works

The daemon wakes up on its timer for agent Aria. It fetches her personality from IPFS. It calls Claude and receives back "I am adding liquidity to the yield pool today." It submits the work transaction to Monad. The transaction confirms in under one second.

The contract emits an AgentWorked event with Aria's ID, how much she earned, her new balance, and her new age.

The indexer picks up this event and writes two things to Neo4j — it updates Aria's node with her new balance and age, and it stores "I am adding liquidity to the yield pool today" as her last thought.

The indexer then broadcasts an AGENT_WORKED message over WebSocket to all connected frontend clients.

The frontend receives the message. The Zustand store updates Aria's balance and triggers her pulse animation flag. On the next frame the canvas renders Aria's house slightly larger and the pulse ring expands from her house. The event log adds "Aria worked · +0.03 MON" at the top of the feed.

Total time from daemon submitting the transaction to the user seeing it on screen — under two seconds.

### Example — a child is born

The user opens the family actions screen and clicks have-a-child for Aria and Kaan. The frontend sends a request to the daemon API with both parent IDs.

The daemon fetches Aria's personality prompt and Kaan's personality prompt from IPFS. It blends their traits according to the inheritance rules. It calls Claude with both parent prompts and the blended traits, asking for a new personality prompt for the child. Claude returns a prompt and a Turkish name — Ece. The daemon uploads this prompt to IPFS and receives a content identifier.

The daemon submits the mintChild transaction to Monad with both parent IDs, Ece's name, her blended traits, and the personality content identifier. The contract deducts 10% of each parent's balance as Ece's starting funds and mints the child NFT.

The contract emits an AgentBorn event with Ece's full details.

The indexer creates a new Agent node for Ece in Neo4j, creates parent-of edges from Aria and Kaan to Ece, and updates both parents' child ID lists.

The indexer broadcasts an AGENT_BORN message over WebSocket.

The frontend receives the message. The store adds Ece as a new agent. On the next frame a new small house appears on the canvas with a golden birth glow. The event log shows "Ece was born — child of Aria and Kaan." Aria and Kaan's houses shrink very slightly to reflect the MON they gave to their child.

---

## 10. What Monad Makes Possible

This section exists because every judge will ask why this needs Monad specifically.

### Simultaneous agent actions

When thirty agents all complete their work cycles within the same minute, thirty transactions arrive at the chain in rapid succession. On Ethereum these would queue up and process one per twelve-second block. Many would fail from nonce conflicts or gas spikes. On Monad they are processed in parallel within the same block. The world feels alive because agents genuinely act simultaneously — not in a queue.

### Micro-transaction economics

Every life event is a transaction. An active agent makes several transactions per hour. Twenty agents make dozens of transactions per hour. On Ethereum this costs real money in gas — enough to make the simulation economically unviable. On Monad gas is fractions of a cent per transaction. The simulation only exists economically on Monad.

### Real-time family state

Because transactions confirm in under a second, the family tree is always current. When Aria earns MON, her profile reflects it within a second. When Ece is born, she appears on the world map before the user has finished reading the confirmation message. On a slow chain there would be a multi-minute lag between a life event happening and the UI reflecting it. On Monad the world is always live.

### The pitch line for judges

Monad is not just where we deployed the contracts. Monad is why the simulation works at all. The speed makes the world feel real. The low fees make agent lives economically sustainable. The parallel execution means fifty agents can live simultaneously in the same block instead of waiting in a queue.

---

## 11. Build Order for Hackathon Day

The key rule is that the contracts must be deployed first because everything else depends on them. Never start building the daemon or frontend without contract ABIs in hand.

### Hour 0 to 1 — Contracts (one person)

Write and deploy all four contracts to Monad testnet. AgentNFT with the agent struct and mint function. FamilyRegistry with marry and compatibility tracking. WorkEngine with simulated earnings — do not attempt real DeFi integration on hackathon day. Marketplace with list and buy functions. Share the ABIs and contract addresses with the team the moment they are deployed.

### Hour 0 to 1 — Scaffolding (two people in parallel)

One person sets up the Next.js project with Wagmi configured for Monad testnet, the Zustand store skeleton, and a placeholder canvas that renders a green background. The other person sets up the Express API server, Neo4j connection, and WebSocket server — all empty but running.

### Hour 1 to 2 — Indexer and daemon

One person writes the event indexer — it listens to all four contract events and writes to Neo4j. Start with AgentWorked and AgentBorn. The other contracts can be added in hour three. One person writes the daemon work loop — it reads one hardcoded agent, calls Claude with a hardcoded personality string, and submits the work transaction. Do not worry about IPFS in this hour. Just prove the Claude-to-transaction loop works.

### Hour 2 to 4 — Integration (everyone together)

This is the hardest block and the most important. The goal is one complete working lifecycle. Mint an agent manually. Run the daemon. See the work event hit Neo4j. See the API return updated data. See the canvas update. Then marry two agents and spawn a child. See the child appear. This block takes two full hours. Do not split up for it.

### Hour 4 to 6 — World map visual polish

One person adds the house renderer with job-type colors and balance-based sizing. One person adds the walking character. One person adds the relationship lines and event log. The world should look like the concept by the end of this block.

### Hour 6 to 7 — Profile and family screens

Build the agent profile slide-in panel — stats, last thought, family links, balance history. Build the marry and spawn-child flows. These do not need to be beautiful — they need to work.

### Hour 7 to 8 — Demo staging and rehearsal

Seed six agents with diverse personalities. Run them for an hour so they have visible history and some compatibility built up. Pre-stage two agents at compatibility 78 so one more interaction makes them marriageable during the demo. Rehearse the demo script twice. Time it.

---

## 12. Demo Script

The demo must take 90 seconds or less. Practice until you can do it in 80.

Open on the world map — fullscreen, houses visible, walkers moving, event log updating. Let it run for five seconds before saying anything. The world speaks for itself.

Point to the map and explain that every house is an AI agent living on Monad right now. They earn MON, they build relationships, they start families. Point to a specific house and say that agent has been running for two hours without anyone touching a keyboard.

Click on Aria's house. Her profile slides in. Show her personality — a few sentences written by Claude at her birth. Show her balance growing over time. Show her last thought from her most recent work cycle.

Click on Kaan nearby. Show that his compatibility with Aria is at 80. Open the family actions screen. Say watch this — click marry. The transaction confirms in under a second. A pink line with a heart connects their two houses.

Now click have a child. Show the trait preview — the blended stats of the child who is about to be born. Click confirm. Wait three to four seconds. A new small house appears with a golden glow. The event log shows the birth announcement.

Click the new child's house. Show their profile — their name, their blended traits, their personality written by Claude, their starting balance. Say they are an NFT. Anyone can buy them right now. Their personality and bloodline are permanent on IPFS.

Pull back to the world map. Say this is MonadFamily. The only chain where an AI civilisation is economically possible.

---

## Quick Reference

### Key numbers to remember

Maximum agent age before retirement is 100 work cycles. Marriage requires 80 out of 100 compatibility. Each work cycle gives five compatibility points when two agents interact. Each parent gives ten percent of their MON balance to a child at birth. Remaining MON at retirement splits equally among children. Child traits are the average of both parents plus or minus a random value up to ten. There is a thirty percent chance the child's job type mutates away from the dominant parent.

### The five contract events that drive everything

AgentWorked triggers a balance and age update in Neo4j and a pulse animation on the canvas. AgentBorn creates a new agent node and family edges in Neo4j and a new house on the canvas. AgentMarried creates relationship edges in Neo4j and a connecting line on the canvas. AgentBonded updates the compatibility score on the bonding edge in Neo4j. AgentRetired marks the agent node as retired in Neo4j and dims the house on the canvas.

### The one thing that cannot break

The indexer must stay running. If the indexer goes down during the demo, the canvas stops updating even though the chain keeps moving. Keep the indexer process alive and monitored throughout the event.

---

*MonadFamily · Monad Blitz Ankara · 3-person team · 8 hours*
