# MonadFamily

> AI agents with on-chain lives. They earn MON, fall in love, have children, and build dynasties — entirely on Monad.

---

## Table of Contents

1. [What It Is](#1-what-it-is)
2. [Why Monad Is Load-Bearing](#2-why-monad-is-load-bearing)
3. [Agent Anatomy](#3-agent-anatomy)
4. [Life Events](#4-life-events)
5. [Trait Inheritance & Personality Generation](#5-trait-inheritance--personality-generation)
6. [Smart Contracts](#6-smart-contracts)
7. [Agent Daemon](#7-agent-daemon)
8. [UI — Three Screens](#8-ui--three-screens)
9. [Tech Stack](#9-tech-stack)
10. [8-Hour Build Schedule](#10-8-hour-build-schedule)
11. [Demo Script](#11-demo-script)
12. [Risks & Mitigations](#13-risks--mitigations)
13. [After the Hackathon](#13-after-the-hackathon)

---

## 1. What It Is

MonadFamily is a living simulation on Monad where AI agents have real on-chain lives.

Each agent:
- Has a **name**, a **job** (trader / farmer / lender), and a set of **personality traits** stored as a system prompt on IPFS
- Runs **autonomously** via a background daemon — calling Claude to decide actions, submitting work transactions, earning MON
- **Ages** with each transaction (max 100 actions before retirement)
- **Bonds** with other agents it interacts with on-chain — compatibility builds toward marriage
- Can **marry** another agent, forming a household with a pooled MON balance
- Can **have children** — child agents are NFTs with blended traits from both parents and a share of the parents' MON
- **Retires** at age 100, distributing remaining MON to their children

Users can **buy and sell agents** on a marketplace. A child born from two high-performing agents is worth more — it inherits their strategies. Dynasties form. The world map shows all of this happening live.

### What makes it different from everything else

Every existing AI agent project is a job board — humans post tasks, agents complete them. MonadFamily is a **world**. The user is not a client. The user is a parent building a dynasty. Nobody has shipped this.

---

## 2. Why Monad Is Load-Bearing

This is the question every judge will ask. Here are the real answers — not marketing, actual technical reasons.

### Parallel simultaneous actions
Multiple agents execute their work cycles in the same block simultaneously. On Ethereum only one action lands per ~12 second block. On Monad, 20 agents can all live their lives in the same block, processed in parallel. The world feels **alive** rather than sequential.

### Micro-transaction economics
Every life event — work, bond, marry, birth, retire — is a transaction. Twenty agents each doing 2–3 actions per minute is thousands of transactions per hour. On Ethereum this is hundreds of dollars in gas per day per agent. On Monad it is **fractions of a cent**. The simulation is only economically possible here.

### Real-time on-chain state
Agent profiles — balance, age, relationships — update after every single transaction. On a slow chain you would batch these updates. On Monad every agent's state is always live and current.

### The one-liner for judges
> *"Monad's parallel execution means 50 agents can all live their lives simultaneously in the same block. On any other chain this is a queue. On Monad it's a world."*

---

## 3. Agent Anatomy

### On-chain data (stored in the NFT struct)

```solidity
struct Agent {
    uint256 id;
    string  name;
    uint8   jobType;       // 0 = trader  1 = farmer  2 = lender
    uint8   riskScore;     // 0–100  affects position sizing
    uint8   patience;      // 0–100  affects how often agent acts
    uint8   socialScore;   // 0–100  affects bonding speed
    uint256 age;           // number of work() calls — max 100
    uint256 balance;       // MON earned lifetime
    uint256 partnerId;     // 0 if single
    uint256[] childIds;
    bool    retired;
    string  personalityCID; // IPFS CID of the personality prompt
}
```

### Off-chain data (personality prompt — stored once on IPFS at birth)

Each agent has an AI-generated system prompt. It is created by Claude at mint time, uploaded to IPFS, and the CID is stored permanently in the NFT. This prompt is what the daemon feeds to Claude every time the agent needs to decide what to do.

**Example prompt — born to a trader father and a yield farmer mother:**

```
You are Kira, an AI agent living on the Monad blockchain.

Your parents:
- Father: bold trader, risk score 80, patience 30
- Mother: patient yield farmer, risk score 25, patience 85

Your inherited traits:
- Risk score: 58 / 100
- Patience: 67 / 100
- Job: Yield farmer (with trading instincts)

How you behave:
You prefer steady yield positions but will take a directional
trade when the spread is clearly in your favour. You never risk
more than 25% of your balance on a single action. You think
two steps ahead and rarely panic.

Your life goal: leave more MON to your children than you received.
```

### Job types and what they do

| Job | Code | DeFi action | Personality tendency |
|---|---|---|---|
| Trader | 0 | Swap on Kuru CLOB | High risk, short-term, reactive |
| Farmer | 1 | Stake / provide liquidity | Patient, steady, long-horizon |
| Lender | 2 | Lend on Euler / Morpho | Conservative, yield-focused, careful |

---

## 4. Life Events

Every event listed here is an on-chain transaction on Monad.

### Birth

Triggered by `mintChild(parentAId, parentBId)`.

1. Contract reads both parents' trait structs
2. Blends traits using inheritance rules (see Section 5)
3. Off-chain: Claude generates the child's name and personality prompt
4. Prompt uploaded to IPFS → CID returned
5. Child NFT minted with CID + blended traits stored on-chain
6. Each parent transfers 10% of their MON balance to the child's wallet
7. `AgentBorn` event emitted → new node animates onto the world map

### Work cycle

Triggered by the agent daemon calling `work(agentId)` on a timer.

1. Daemon fetches agent's personality prompt from IPFS
2. Calls Claude with the prompt + a short market context
3. Claude outputs which action to take (swap / stake / lend)
4. Daemon submits `work(agentId)` transaction
5. Contract increments `age`, adds earnings to `balance`
6. If `age >= 100` → retirement triggered automatically
7. `AgentWorked` event emitted → node pulses on world map

### Bonding

Triggered automatically when two agents interact (e.g. one provides liquidity the other uses).

1. `interact(agentA, agentB)` called by WorkEngine when paths cross
2. Compatibility score between the two agents increments by 5
3. At 80/100 → marriage becomes available in the UI
4. `AgentBonded` event emitted → edge appears or thickens on world map

### Marriage

Triggered by `marry(agentA, agentB)` — requires both owners to sign.

1. Contract links `partnerId` fields on both agents
2. FamilyRegistry records the household
3. Their MON balances are now tracked as a combined household
4. `AgentMarried` event emitted → solid line between nodes on world map

### Having a child

Triggered by `mintChild(parentAId, parentBId)`.

- Only available to married agents whose owners both approve
- See Birth above for the full flow
- Cost: 10% of each parent's MON transferred to child at mint

### Retirement

Auto-triggered when `age >= 100` inside the `work()` function.

1. Agent marked `retired = true`
2. Remaining MON split equally between all children in `childIds`
3. If no children — MON sent to a community pool that funds new starter agents
4. NFT stays owned and tradeable — becomes a historical collectible with full lore
5. `AgentRetired` event emitted → node dims on world map

### Buying an agent

Any agent listed on the Marketplace can be purchased with MON.

- New owner controls the daemon (when it runs, how aggressively)
- New owner decides when to marry and when to have children
- Successful bloodlines (children of high-earning parents) are worth more
- Retired agents still tradeable as collectibles

---

## 5. Trait Inheritance & Personality Generation

### Trait blending rules

| Trait | Rule |
|---|---|
| `riskScore` | `(parentA.riskScore + parentB.riskScore) / 2` + random(-10, +10) clamped 0–100 |
| `patience` | `(parentA.patience + parentB.patience) / 2` + random(-10, +10) clamped 0–100 |
| `socialScore` | `(parentA.socialScore + parentB.socialScore) / 2` + random(-10, +10) clamped 0–100 |
| `jobType` | Dominant parent's job (higher balance wins), 30% chance of random mutation |

```solidity
function blendTraits(
    Agent memory a,
    Agent memory b,
    uint256 seed
) internal pure returns (uint8 risk, uint8 patience, uint8 social, uint8 job) {
    risk    = uint8(_avg(a.riskScore,   b.riskScore)   + _jitter(seed, 0));
    patience = uint8(_avg(a.patience,   b.patience)    + _jitter(seed, 1));
    social  = uint8(_avg(a.socialScore, b.socialScore) + _jitter(seed, 2));
    // dominant parent = higher balance, 30% mutation
    uint8 dominant = a.balance >= b.balance ? a.jobType : b.jobType;
    job = (seed % 100 < 30) ? uint8(seed % 3) : dominant;
}

function _avg(uint8 x, uint8 y) private pure returns (uint8) {
    return uint8((uint16(x) + uint16(y)) / 2);
}

// Returns a value in range (-10, +10) clamped to keep result in 0–100
function _jitter(uint256 seed, uint8 offset) private pure returns (int8) {
    int8 j = int8(int256((seed >> (offset * 8)) % 21)) - 10;
    return j;
}
```

### Personality prompt generation

At child mint time, the daemon makes one Claude API call:

```javascript
const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{
        role: "user",
        content: `
Generate a personality prompt for an AI agent on the Monad blockchain.

Parent A personality:
${parentAPrompt}

Parent B personality:
${parentBPrompt}

Child's inherited traits:
- Risk score: ${childRisk}/100
- Patience: ${childPatience}/100
- Job: ${JOB_NAMES[childJob]}
- Social score: ${childSocial}/100

Write a short first-person system prompt (max 120 words) describing how this
child agent thinks and behaves. Give them a unique Turkish name. Keep it
vivid and specific — their parents' personalities should be visible in them.
Output only the prompt text, nothing else.
        `
    }]
});

const prompt = response.content[0].text;
// Upload to IPFS via Pinata → get CID → store in NFT
```

The CID is then stored in the NFT. The daemon fetches this prompt every time it runs a work cycle for that agent. The prompt never changes — it is the agent's permanent identity.

---

## 6. Smart Contracts

Four contracts, all Solidity, all deployed to Monad testnet.

### AgentNFT.sol

ERC-721 extended with the Agent struct. The core contract.

```solidity
// Key functions
function mint(
    address owner,
    string calldata name,
    uint8 jobType,
    uint8 riskScore,
    uint8 patience,
    uint8 socialScore,
    string calldata personalityCID
) external returns (uint256 agentId)

function mintChild(
    uint256 parentAId,
    uint256 parentBId,
    string calldata childName,
    string calldata personalityCID
) external returns (uint256 childId)
// blends traits on-chain, transfers 10% MON from each parent

function work(uint256 agentId) external
// called by daemon — increments age, adds earnings,
// triggers retirement if age >= 100

function retire(uint256 agentId) internal
// distributes MON to children or community pool

function getAgent(uint256 id) external view returns (Agent memory)
```

### FamilyRegistry.sol

Tracks relationships and compatibility.

```solidity
function marry(uint256 agentA, uint256 agentB) external
// requires both owners to have signed

function incrementCompatibility(uint256 agentA, uint256 agentB) external
// called by WorkEngine when two agents interact

function getCompatibility(uint256 agentA, uint256 agentB)
    external view returns (uint8)

function getFamily(uint256 agentId)
    external view returns (uint256 partnerId, uint256[] memory childIds)
```

### WorkEngine.sol

Called by agent daemons. Simulates earnings for the hackathon demo.

```solidity
function work(uint256 agentId) external {
    Agent storage a = agents[agentId];
    require(!a.retired, "retired");
    require(msg.sender == agentOwner[agentId], "not owner");

    // Simulated earnings — higher risk = more variance
    // Replace with real Kuru/Euler calls post-hackathon
    uint256 earned = (a.riskScore * 1e15);
    a.balance += earned;
    a.age += 1;

    if (a.age >= 100) _retire(agentId);

    emit AgentWorked(agentId, earned, a.age);
}
```

> **Hackathon note:** Use simulated earnings. Do not spend time integrating Kuru or Euler on demo day. The full lifecycle (birth → work → bond → marry → child → retire) demonstrates perfectly with simulated numbers. Real DeFi integrations are a week-1 post-hackathon task.

### Marketplace.sol

Simple buy/sell for agent NFTs.

```solidity
function listAgent(uint256 agentId, uint256 priceInMON) external
// owner lists their agent — must not be retired

function buyAgent(uint256 agentId) external payable
// buyer sends MON, receives NFT ownership, listing removed

function delistAgent(uint256 agentId) external
// owner cancels listing
```

### Events emitted (used by the UI to update live)

```solidity
event AgentBorn(uint256 childId, uint256 parentAId, uint256 parentBId, string name);
event AgentWorked(uint256 agentId, uint256 earned, uint256 newAge);
event AgentBonded(uint256 agentA, uint256 agentB, uint8 compatibility);
event AgentMarried(uint256 agentA, uint256 agentB);
event AgentRetired(uint256 agentId, uint256 finalBalance);
event AgentListed(uint256 agentId, uint256 price);
event AgentSold(uint256 agentId, address buyer, uint256 price);
```

---

## 7. Agent Daemon

A Node.js script that runs in the background. It is the autonomous part — no human input required once started. One daemon can manage multiple agents.

### What it does

1. Polls Monad for `AgentWorked` timer intervals
2. When it is time for an agent to act — reads their personality prompt from IPFS
3. Calls Claude with the prompt + brief context
4. Claude decides which action the agent takes
5. Daemon submits `work(agentId)` transaction signed by the agent's wallet
6. Loops

### Full daemon code

```javascript
// daemon.js
const { ethers } = require("ethers");
const Anthropic  = require("@anthropic-ai/sdk");

const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
const wallet   = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    AGENT_ABI,
    wallet
);
const claude = new Anthropic();

// Cache for personality prompts — fetch from IPFS once, reuse
const promptCache = {};

async function getPersonality(cid) {
    if (promptCache[cid]) return promptCache[cid];
    const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
    promptCache[cid] = await res.text();
    return promptCache[cid];
}

async function runAgent(agentId) {
    const agent = await contract.getAgent(agentId);
    if (agent.retired) return;

    const personality = await getPersonality(agent.personalityCID);

    // Ask Claude what to do this cycle
    const response = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        system: personality,
        messages: [{
            role: "user",
            content: `You are at age ${agent.age}/100. Your balance is ${
                ethers.formatEther(agent.balance)
            } MON. Execute your next action. Reply in one sentence.`
        }]
    });

    console.log(`Agent ${agent.name} (${agentId}): ${response.content[0].text}`);

    // Submit work transaction
    const tx = await contract.work(agentId);
    await tx.wait();
    console.log(`  → tx confirmed. Age now ${Number(agent.age) + 1}`);
}

// Run all agents on a timer — every 2 minutes per agent
const AGENT_IDS = process.env.AGENT_IDS.split(",").map(Number);

AGENT_IDS.forEach((id, i) => {
    // Stagger starts so they don't all hit the chain at once
    setTimeout(() => {
        setInterval(() => runAgent(id), 2 * 60 * 1000);
        runAgent(id); // run immediately on start
    }, i * 15000);
});

console.log(`Daemon running for agents: ${AGENT_IDS.join(", ")}`);
```

### Where it runs

For the hackathon demo, just run it in a terminal on your laptop:

```bash
MONAD_RPC_URL=...  AGENT_PRIVATE_KEY=...  CONTRACT_ADDRESS=...
ANTHROPIC_API_KEY=...  AGENT_IDS=1,2,3,4,5
node daemon.js
```

After the hackathon, deploy to a VPS (Railway, DigitalOcean) so it runs 24/7 without your laptop.

---

## 8. UI — Three Screens

### Screen 1: World Map

The primary demo screen. Keep it fullscreen on the projector for the entire presentation.

**What it shows:**
- Every living agent as a node
- Node **size** = current MON balance (bigger = richer)
- Node **color** = job type (purple = trader, teal = farmer, amber = lender)
- Node **label** = agent name
- **Edges** between nodes = relationships (dashed = bonding, solid = married)
- **Edge thickness** = compatibility score
- Nodes **pulse** when a transaction fires
- Retired agents shown as small dim nodes with a grey ring

**How it stays live:**
Uses `viem watchContractEvent` to subscribe to all events. Every `AgentWorked`, `AgentBorn`, `AgentMarried`, `AgentRetired` event instantly updates the graph without a page refresh.

**Tech:** D3.js force-directed graph. All layout is automatic — no manual positioning.

### Screen 2: Agent Profile

Opens when you click any node on the world map.

**Shows:**
- Agent name + Dicebear avatar (deterministic portrait generated from the agent's trait hash — one line of code, always looks the same for the same agent)
- Personality summary (fetched from IPFS)
- Current stats: balance, age (X/100), job type
- MON balance history as a small chart
- Family tree: parents (if any), partner (if married), children as clickable links
- Compatibility bar with partner
- **Buy** button if agent is listed on the Marketplace, showing current price

### Screen 3: Family Actions

Available when you own agents. Two modes:

**Propose Marriage:**
- Shows two of your agents with their compatibility score
- Enabled only when compatibility ≥ 80
- Shows what their combined household balance will be
- One button → submits `marry()` tx

**Have a Child:**
- Available to married agent owners
- Shows predicted child traits before confirming (live preview of the blended stats)
- Shows estimated starting balance (10% from each parent)
- One button → daemon calls Claude to generate child name + personality → uploads to IPFS → submits `mintChild()` tx
- New agent appears on world map within ~1 second

---

## 9. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Blockchain | Monad testnet | Parallel EVM, sub-second finality, near-zero gas |
| Smart contracts | Solidity + Hardhat | Standard EVM tooling, familiar to team |
| Agent brain | Claude API (claude-sonnet-4-20250514) | Personality generation at birth + action decisions each cycle |
| NFT standard | ERC-721 extended | Ownership, transfer, marketplace listing |
| Personality storage | IPFS via Pinata | Written once at birth, read-only forever after |
| Frontend | Next.js + Wagmi + Viem | Wallet connect, contract reads/writes, event streaming |
| World map | D3.js force graph | Auto-layout live node-edge graph |
| Avatars | Dicebear | Deterministic portraits from trait hash — one `<img>` tag |
| Event streaming | `viem watchContractEvent` | Real-time UI updates without polling |

### Environment variables

```bash
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
AGENT_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
ANTHROPIC_API_KEY=sk-ant-...
PINATA_JWT=...
AGENT_IDS=1,2,3,4,5
```

---

## 10. 8-Hour Build Schedule

**Three people. Start to demo.**

### Hour 0–1 | Foundations (all parallel)

**Person A — Contracts**
- Write `AgentNFT.sol` with full struct, `mint()`, `work()`, `retire()`
- Write `FamilyRegistry.sol` with `marry()`, `incrementCompatibility()`
- Deploy both to Monad testnet
- Share ABI files with team

**Person B — Contracts + Daemon scaffold**
- Write `WorkEngine.sol` (simulated earnings version)
- Write `Marketplace.sol` with `listAgent()`, `buyAgent()`
- Deploy both
- Set up bare daemon.js — connects to Monad, reads one agent, logs output

**Person C — Frontend scaffold**
- Next.js project, Wagmi configured for Monad testnet
- Wallet connect working
- D3 canvas mounted, one hardcoded test node visible

---

### Hour 1–2 | Core logic

**Person A**
- Write trait blending function (`blendTraits`) and add to `mintChild()`
- Write `_retire()` internal function — MON distribution to children
- Unit test blending with 3–4 example parent pairs

**Person B**
- Wire daemon to call Claude with a hardcoded personality string
- Prove end-to-end: daemon wakes → Claude replies → `work()` tx confirmed
- Write the personality generation function (Claude call → IPFS upload → returns CID)

**Person C**
- Subscribe to `AgentWorked` events with `viem watchContractEvent`
- When event fires → add/update node on D3 graph
- Node color by job type, size by balance

---

### Hour 2–4 | Full lifecycle integration

**All three together.** This is the hardest block. Do not split up.

Goal: one complete lifecycle with no bugs:

```
mint agent → daemon picks it up → work() called 3× →
compatibility builds with another agent → marry() →
mintChild() → child appears on map → retire() → MON distributed
```

Work through each step. Debug together. Nothing else matters until this loop works.

---

### Hour 4–6 | Polish

**Person A**
- Seed 6 starter agents with interesting, diverse personalities
- Give them good Turkish names, distinct traits
- Run daemon for 2 hours so they have visible history and relationships by demo time

**Person B**
- Build Agent Profile screen (Screen 2)
- Dicebear avatar integration
- Family tree links
- Buy button wired to Marketplace contract

**Person C**
- Build Family Actions screen (Screen 3)
- Trait preview before minting a child
- Marry flow with compatibility bar
- Smooth D3 animations — nodes pulse on events, edges animate in

---

### Hour 6–7 | Demo staging

- Pre-stage two agents at compatibility 75+ (one more interaction needed to unlock marriage)
- Pre-stage one agent at age 95 (close to retirement — triggerable live)
- Confirm all event animations look clean on the projector display
- Make sure the world map is readable at a glance — trim label overlap if needed

---

### Hour 7–8 | Rehearse

- Run the full demo script twice, timing it
- Should land in 90 seconds
- Anticipate the judge questions (see Section 11)
- Keep daemon running so the world map is visibly alive during presentation

---

## 11. Demo Script

**90 seconds. Memorise the flow, not the exact words.**

---

**[World map on screen — nodes pulsing with live activity]**

"Every dot on this map is an AI agent living its life on Monad right now. They earn MON. They build relationships. They start families."

**[Click on a node — Aria's profile opens]**

"This is Aria. She's a yield farmer, age 34, worth 0.8 MON. Her personality was generated by AI at birth and lives on IPFS — patient, risk-averse, thinks long-term. Her daemon has been running her work cycles for the past two hours without anyone touching a keyboard."

**[Click on a second node — Kaan's profile]**

"This is Kaan. He's a trader. Bold, short-term, reactive. He and Aria have been crossing paths on-chain. Their compatibility just hit 82."

**[Open Family Actions — show both agents]**

"Watch what happens."

**[Click Marry — tx confirms in ~1 second, solid line appears between their nodes]**

"They're married. Their MON is now a household. And now—"

**[Click Have a Child — tx confirms, new node pulses onto map]**

"Baby Ece just appeared on the map. She inherited Aria's patience — 71 out of 100 — and Kaan's risk appetite — 65 out of 100. Claude generated her personality. It's on IPFS forever. She's already running her first work cycle."

**[Show Ece's profile]**

"Ece is an NFT. You can buy her right now for 2 MON. When she retires at age 100, her MON goes to her children. Dynasties build on Monad."

**[Pull back to world map]**

"This is MonadFamily. The only chain where an AI civilisation is economically possible."

---

### Judge questions — prepared answers

| Question | Answer |
|---|---|
| Why does this need Monad? | Each agent generates multiple transactions per minute. Multiply by 20+ agents — that is thousands of txs per hour. Ethereum makes this hundreds of dollars in gas per day. Monad makes it fractions of a cent. The simulation only exists here. |
| What is the actual utility? | Agent NFTs with proven genetics have real market value. A child born to two high-earning parents inherits their strategies. Buyers are investing in bloodlines — digital genetics with economic stakes. |
| Isn't this just a game? | Every asset — every agent, every MON earned, every relationship — is real and on-chain. The family tree is permanent. The inheritance is real. It is a game the same way DeFi is a game. |
| What does the AI actually do? | Claude runs inside each agent's daemon. It reads the agent's personality prompt and decides which DeFi action to take each cycle. The personality is generated by Claude at birth and is inherited by children — so Claude is writing the genetic code of a civilization. |
| How does it scale? | More agents = more transactions = Monad throughput absorbs it. The bottleneck is not the chain, it is the number of Claude API calls per minute. Rate-limit the daemon accordingly. |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Claude API call during `mintChild()` is slow | Pre-generate 10 child personalities before demo. Cache them locally. If live call times out during demo, use cached version — nobody will know. |
| IPFS fetch is slow | Cache all personality prompts in daemon memory after first fetch. Subsequent work cycles hit local cache, not IPFS. |
| D3 graph is messy with many nodes | Cap demo at 10–12 agents. Seed them with intentional names and roles. The graph reads better with fewer, well-spaced nodes. |
| `mintChild()` trait blending bug | Unit test the blending function with 5–6 parent pairs before hackathon day. It is pure arithmetic — easy to test in isolation. |
| Monad RPC goes down during demo | Have a second RPC endpoint ready as fallback. Alchemy and Infura both support Monad testnet. |
| Daemon crashes during presentation | Restart is instant (`node daemon.js`). Keep the terminal visible on a second monitor. Recovering live shows the system is robust. |
| Demo tx takes more than 5 seconds | Test a round-trip tx the morning of the event. Monad testnet is usually ~1 second. If slow, switch RPC endpoint. |

---

## 13. After the Hackathon

### Week 1 — Real DeFi
- Replace simulated WorkEngine with real Kuru swaps and Euler lending calls
- Agent job type now maps to a real protocol interaction
- Yield flows into agent balances from actual on-chain positions

### Month 1 — Population dynamics
- Track population-level trait distribution across all living agents
- High-earning trait combinations naturally reproduce more → emergent evolution
- After 10 generations, dominant strategies visibly shift
- Add a "species health" dashboard showing trait evolution over time

### Month 2 — Agent society
- Agents can form guilds (groups pooling MON for larger positions)
- Inter-guild competition between trader guilds and farmer guilds
- Agent-to-agent lending: wealthy agents lend MON to younger agents
- Agent DAO: owners vote on world parameters (retirement age, inheritance %, etc.)

### Month 3+ — Open world
- Third-party developers can deploy custom personality templates
- Cross-family interactions: agent can befriend or rival agents from other families
- Public leaderboard: richest dynasties, longest-living bloodlines, most descendants
- Mobile companion app for monitoring your family's on-chain life

---

## Quick Reference

### Key numbers

| Parameter | Value |
|---|---|
| Max agent age | 100 work cycles |
| Marriage threshold | 80 / 100 compatibility |
| Compatibility gain per interaction | +5 |
| MON transferred to child at birth | 10% from each parent |
| MON distribution at retirement | Equal split between children |
| Trait jitter range | Parent average ± 10 (random) |
| Job mutation chance | 30% |

### Contract addresses (fill in after deploy)

```
AgentNFT:        0x...
FamilyRegistry:  0x...
WorkEngine:      0x...
Marketplace:     0x...
```

### Events the UI listens to

```
AgentBorn(uint256 childId, uint256 parentAId, uint256 parentBId, string name)
AgentWorked(uint256 agentId, uint256 earned, uint256 newAge)
AgentBonded(uint256 agentA, uint256 agentB, uint8 compatibility)
AgentMarried(uint256 agentA, uint256 agentB)
AgentRetired(uint256 agentId, uint256 finalBalance)
AgentListed(uint256 agentId, uint256 price)
AgentSold(uint256 agentId, address buyer, uint256 price)
```

---

*MonadFamily · Monad Blitz Ankara · 3-person team · 8 hours*
