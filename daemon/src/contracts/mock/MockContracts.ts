import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { Agent, JobType } from '../../types';
import { SEED_AGENTS } from '../../seeds/agents';

// In-memory agent store
const store = new Map<number, Agent>();

// Pre-populate with seed agents
for (const s of SEED_AGENTS) {
  store.set(s.id, {
    id: BigInt(s.id),
    name: s.name,
    jobType: s.jobType,
    riskScore: s.riskScore,
    patience: s.patience,
    socialScore: s.socialScore,
    age: 0n,
    balance: ethers.parseEther('5.0'),
    partnerId: 0n,
    childIds: [],
    retired: false,
    personalityCID: `mock-cid-${s.id}`,
  });
}

let nextId = SEED_AGENTS.length + 1;

// Compatibility store: "aId-bId" → number (aId < bId always)
const compatibilityStore = new Map<string, number>();

function compatKey(a: bigint, b: bigint): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Approval stores
const marriageApprovals = new Map<string, Set<number>>(); // pairKey → Set of agentIds that approved
const childApprovals = new Map<string, Set<number>>();

// Mock tx receipt
function mockTx(hash?: string) {
  const h = hash ?? `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`;
  return {
    hash: h,
    wait: async () => ({ status: 1, transactionHash: h }),
  };
}

export class MockAgentNFT extends EventEmitter {
  async getAgent(agentId: bigint | number): Promise<Agent> {
    const id = Number(agentId);
    const agent = store.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    return { ...agent };
  }

  async exists(agentId: bigint | number): Promise<boolean> {
    return store.has(Number(agentId));
  }

  async ownerOf(_agentId: bigint | number): Promise<string> {
    return '0x0000000000000000000000000000000000000001';
  }

  async ownerOrApproved(_caller: string, agentId: bigint | number): Promise<boolean> {
    return store.has(Number(agentId));
  }

  async totalAgents(): Promise<bigint> {
    return BigInt(store.size);
  }

  async mint(
    name: string,
    jobType: number,
    riskScore: number,
    patience: number,
    socialScore: number,
    personalityCID: string
  ) {
    const id = nextId++;
    const agent: Agent = {
      id: BigInt(id),
      name,
      jobType: jobType as JobType,
      riskScore,
      patience,
      socialScore,
      age: 0n,
      balance: ethers.parseEther('2.0'),
      partnerId: 0n,
      childIds: [],
      retired: false,
      personalityCID,
    };
    store.set(id, agent);
    this.emit('AgentBorn', BigInt(id), 0n, 0n, name);
    return mockTx();
  }

  async mintChild(parentAId: bigint, parentBId: bigint, name: string, personalityCID: string) {
    const parentA = store.get(Number(parentAId));
    const parentB = store.get(Number(parentBId));
    if (!parentA || !parentB) throw new Error('Parent not found');

    // Consume child approvals
    const pairKey = compatKey(parentAId, parentBId);
    const approvals = childApprovals.get(pairKey);
    if (!approvals || !approvals.has(Number(parentAId)) || !approvals.has(Number(parentBId))) {
      throw new Error('Child approval missing');
    }
    childApprovals.delete(pairKey);

    const childId = nextId++;
    // Blend traits (simplified mirror of Solidity logic)
    const riskScore = Math.min(100, Math.max(0, Math.floor((parentA.riskScore + parentB.riskScore) / 2) + (Math.random() * 20 - 10)));
    const patience = Math.min(100, Math.max(0, Math.floor((parentA.patience + parentB.patience) / 2) + (Math.random() * 20 - 10)));
    const socialScore = Math.min(100, Math.max(0, Math.floor((parentA.socialScore + parentB.socialScore) / 2) + (Math.random() * 20 - 10)));
    const dominantParent = parentA.balance >= parentB.balance ? parentA : parentB;
    const jobType: JobType = Math.random() < 0.3
      ? ([0, 1, 2].filter((j) => j !== dominantParent.jobType)[Math.floor(Math.random() * 2)] as JobType)
      : dominantParent.jobType;

    // 10% MON from each parent
    const childBalance = parentA.balance / 10n + parentB.balance / 10n;
    const updatedParentA = { ...parentA, balance: parentA.balance - parentA.balance / 10n, childIds: [...parentA.childIds, BigInt(childId)] };
    const updatedParentB = { ...parentB, balance: parentB.balance - parentB.balance / 10n, childIds: [...parentB.childIds, BigInt(childId)] };
    store.set(Number(parentA.id), updatedParentA);
    store.set(Number(parentB.id), updatedParentB);

    const child: Agent = {
      id: BigInt(childId),
      name,
      jobType,
      riskScore: Math.round(riskScore),
      patience: Math.round(patience),
      socialScore: Math.round(socialScore),
      age: 0n,
      balance: childBalance,
      partnerId: 0n,
      childIds: [],
      retired: false,
      personalityCID,
    };
    store.set(childId, child);

    this.emit('AgentBorn', BigInt(childId), parentAId, parentBId, name);
    return mockTx();
  }

  async setPartnerIds(agentAId: bigint, agentBId: bigint) {
    const a = store.get(Number(agentAId));
    const b = store.get(Number(agentBId));
    if (!a || !b) throw new Error('Agent not found');
    store.set(Number(agentAId), { ...a, partnerId: agentBId });
    store.set(Number(agentBId), { ...b, partnerId: agentAId });
    return mockTx();
  }

  async retireAndDistribute(agentId: bigint | number): Promise<{ finalBalance: bigint; communityAllocation: bigint }> {
    const id = Number(agentId);
    const agent = store.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);

    const finalBalance = agent.balance;

    if (agent.childIds.length > 0) {
      const share = finalBalance / BigInt(agent.childIds.length);
      for (const childId of agent.childIds) {
        const child = store.get(Number(childId));
        if (child) {
          store.set(Number(childId), { ...child, balance: child.balance + share });
        }
      }
      store.set(id, { ...agent, balance: 0n, retired: true });
      this.emit('AgentRetired', BigInt(id), finalBalance);
      return { finalBalance, communityAllocation: 0n };
    }

    store.set(id, { ...agent, balance: 0n, retired: true });
    this.emit('AgentRetired', BigInt(id), finalBalance);
    return { finalBalance, communityAllocation: finalBalance };
  }

  // Required for ethers contract.on() compatibility
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

export class MockFamilyRegistry extends EventEmitter {
  async approveMarriage(agentSelfId: bigint, agentOtherId: bigint) {
    const pairKey = compatKey(agentSelfId, agentOtherId);
    if (!marriageApprovals.has(pairKey)) marriageApprovals.set(pairKey, new Set());
    marriageApprovals.get(pairKey)!.add(Number(agentSelfId));
    return mockTx();
  }

  async approveChild(parentAId: bigint, parentBId: bigint) {
    // parentAId is the approver (the first param is the caller's own agent)
    const pairKey = compatKey(parentAId, parentBId);
    if (!childApprovals.has(pairKey)) childApprovals.set(pairKey, new Set());
    childApprovals.get(pairKey)!.add(Number(parentAId));
    return mockTx();
  }

  async consumeChildApproval(parentAId: bigint, parentBId: bigint) {
    const pairKey = compatKey(parentAId, parentBId);
    const approvals = childApprovals.get(pairKey);
    if (!approvals || !approvals.has(Number(parentAId)) || !approvals.has(Number(parentBId))) {
      throw new Error('Child approval missing');
    }
    childApprovals.delete(pairKey);
    return mockTx();
  }

  async marry(agentAId: bigint, agentBId: bigint) {
    const a = store.get(Number(agentAId));
    const b = store.get(Number(agentBId));
    if (!a || !b) throw new Error('Agent not found');
    if (a.partnerId !== 0n) throw new Error(`Agent ${agentAId} already married`);
    if (b.partnerId !== 0n) throw new Error(`Agent ${agentBId} already married`);

    // Check compatibility
    const compat = compatibilityStore.get(compatKey(agentAId, agentBId)) ?? 0;
    if (compat < 80) throw new Error(`Compatibility too low: ${compat}/80`);

    // Check approvals
    const pairKey = compatKey(agentAId, agentBId);
    const approvals = marriageApprovals.get(pairKey);
    if (!approvals || !approvals.has(Number(agentAId)) || !approvals.has(Number(agentBId))) {
      throw new Error('Marriage approval missing');
    }
    marriageApprovals.delete(pairKey);

    store.set(Number(agentAId), { ...a, partnerId: agentBId });
    store.set(Number(agentBId), { ...b, partnerId: agentAId });

    this.emit('AgentMarried', agentAId, agentBId);
    return mockTx();
  }

  async incrementCompatibility(agentAId: bigint, agentBId: bigint) {
    const key = compatKey(agentAId, agentBId);
    const current = compatibilityStore.get(key) ?? 0;
    const next = Math.min(100, current + 5);
    compatibilityStore.set(key, next);
    this.emit('AgentBonded', agentAId, agentBId, next);
    return mockTx();
  }

  async getCompatibility(agentAId: bigint, agentBId: bigint): Promise<number> {
    return compatibilityStore.get(compatKey(agentAId, agentBId)) ?? 0;
  }

  async getFamily(agentId: bigint): Promise<{ partnerId: bigint; childIds: bigint[] }> {
    const agent = store.get(Number(agentId));
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    return { partnerId: agent.partnerId, childIds: agent.childIds };
  }

  async areMarried(agentAId: bigint, agentBId: bigint): Promise<boolean> {
    const a = store.get(Number(agentAId));
    const b = store.get(Number(agentBId));
    if (!a || !b) return false;
    return a.partnerId === agentBId && b.partnerId === agentAId;
  }

  async getHouseholdBalance(agentId: bigint): Promise<bigint> {
    const agent = store.get(Number(agentId));
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    let balance = agent.balance;
    if (agent.partnerId !== 0n) {
      const partner = store.get(Number(agent.partnerId));
      if (partner) balance += partner.balance;
    }
    return balance;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

export class MockWorkEngine extends EventEmitter {
  async work(agentId: bigint | number, counterpartyId?: bigint | number) {
    const id = Number(agentId);
    const agent = store.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    if (agent.retired) throw new Error(`Agent ${id} is retired`);

    // Increment compatibility if counterparty provided
    const cpId = counterpartyId ? Number(counterpartyId) : 0;
    if (cpId !== 0 && cpId !== id) {
      const counterparty = store.get(cpId);
      if (counterparty && !counterparty.retired) {
        await mockFamilyRegistry.incrementCompatibility(BigInt(id), BigInt(cpId));
      }
    }

    const earned = ethers.parseEther((Math.random() * 0.1 + 0.01).toFixed(4));
    const newAge = agent.age + 1n;
    store.set(id, { ...agent, age: newAge, balance: agent.balance + earned });

    this.emit('AgentWorked', BigInt(id), earned, newAge);

    if (newAge >= 100n) {
      const updated = store.get(id)!;
      store.set(id, { ...updated, retired: true });
      this.emit('AgentRetired', BigInt(id), updated.balance);
    }

    return mockTx();
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

interface ListingEntry {
  agentId: bigint;
  seller: string;
  price: bigint;
  active: boolean;
}

export class MockMarketplace extends EventEmitter {
  private listings = new Map<number, ListingEntry>();

  async listAgent(agentId: bigint, price: bigint) {
    this.listings.set(Number(agentId), {
      agentId,
      seller: '0x0000000000000000000000000000000000000001',
      price,
      active: true,
    });
    this.emit('AgentListed', agentId, price, '0x0000000000000000000000000000000000000001');
    return mockTx();
  }

  async buyAgent(agentId: bigint) {
    const listing = this.listings.get(Number(agentId));
    if (!listing || !listing.active) throw new Error(`Agent ${agentId} not listed`);
    this.listings.set(Number(agentId), { ...listing, active: false });
    this.emit('AgentSold', agentId, listing.price, '0x0000000000000000000000000000000000000002');
    return mockTx();
  }

  async delistAgent(agentId: bigint) {
    const listing = this.listings.get(Number(agentId));
    if (listing) this.listings.set(Number(agentId), { ...listing, active: false });
    return mockTx();
  }

  async getListing(agentId: bigint): Promise<ListingEntry> {
    return this.listings.get(Number(agentId)) ?? {
      agentId,
      seller: '0x0000000000000000000000000000000000000000',
      price: 0n,
      active: false,
    };
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

// Singleton instances
export const mockAgentNFT = new MockAgentNFT();
export const mockFamilyRegistry = new MockFamilyRegistry();
export const mockWorkEngine = new MockWorkEngine();
export const mockMarketplace = new MockMarketplace();

// Export store for tests/inspection
export { store as mockAgentStore };
