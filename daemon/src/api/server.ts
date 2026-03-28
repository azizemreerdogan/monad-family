import http from 'http';
import { getAgentNFT, getFamilyRegistry } from '../contracts';
import { callClaude } from '../claude/client';
import { buildNewAgentPersonalityPrompt } from '../claude/prompts';
import { uploadPersonality } from '../ipfs/client';
import { onAgentAdded } from '../agent/scheduler';
import { checkAndExecuteChildBirths } from '../agent/childbirth';
import { logger } from '../utils/logger';
import config from '../config';
import { JobType } from '../types';
import { withRetry } from '../utils/retry';

// Use the first configured wallet (agent 1) as the admin signer for minting
import { getWallet } from '../agent/wallets';

const PORT = parseInt(process.env.API_PORT ?? '3000', 10);

interface CreateAgentBody {
  name: string;
  jobType: 0 | 1 | 2;
  riskScore: number;
  patience: number;
  socialScore: number;
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function validateBody(body: unknown): CreateAgentBody {
  if (!body || typeof body !== 'object') throw new Error('Body must be a JSON object');
  const b = body as Record<string, unknown>;

  if (typeof b.name !== 'string' || b.name.trim() === '') throw new Error('"name" is required (string)');
  if (![0, 1, 2].includes(b.jobType as number)) throw new Error('"jobType" must be 0 (Trader), 1 (Farmer), or 2 (Lender)');

  const riskScore = Number(b.riskScore);
  const patience = Number(b.patience);
  const socialScore = Number(b.socialScore);

  if (!Number.isInteger(riskScore) || riskScore < 0 || riskScore > 100) throw new Error('"riskScore" must be 0–100');
  if (!Number.isInteger(patience) || patience < 0 || patience > 100) throw new Error('"patience" must be 0–100');
  if (!Number.isInteger(socialScore) || socialScore < 0 || socialScore > 100) throw new Error('"socialScore" must be 0–100');

  return {
    name: b.name.trim(),
    jobType: b.jobType as 0 | 1 | 2,
    riskScore,
    patience,
    socialScore,
  };
}

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

async function handleCreateAgent(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  let params: CreateAgentBody;
  try {
    params = validateBody(body);
  } catch (err) {
    sendJson(res, 400, { error: (err as Error).message });
    return;
  }

  logger.info('API: creating new agent', { name: params.name, jobType: params.jobType });

  try {
    // 1. Generate personality text via Gemini
    const userMessage = buildNewAgentPersonalityPrompt(params.name, params);
    const personalityText = await callClaude({
      system: 'You are a creative writer designing personalities for AI blockchain agents.',
      userMessage,
      maxTokens: 300,
    });

    // 2. Upload to IPFS
    const cid = await uploadPersonality(personalityText);

    // 3. Mint on-chain
    const wallet = getWallet(1);
    const agentNFT = getAgentNFT(wallet) as unknown as {
      mint: (
        recipient: string,
        name: string,
        jobType: number,
        riskScore: number,
        patience: number,
        socialScore: number,
        personalityCID: string,
      ) => Promise<{ hash: string; wait: () => Promise<{ logs?: unknown[] }> }>;
      totalAgents: () => Promise<bigint>;
    };

    const tx = await agentNFT.mint(
      wallet.address,
      params.name,
      params.jobType as JobType,
      params.riskScore,
      params.patience,
      params.socialScore,
      cid,
    );
    await tx.wait();

    // 4. Get the new agent's ID and add to scheduler
    const total = await agentNFT.totalAgents();
    const newAgentId = Number(total);
    onAgentAdded(newAgentId);

    logger.info('API: agent created and scheduled', { agentId: newAgentId, name: params.name, cid });

    sendJson(res, 201, {
      agentId: newAgentId,
      name: params.name,
      jobType: params.jobType,
      riskScore: params.riskScore,
      patience: params.patience,
      socialScore: params.socialScore,
      personalityCID: cid,
      personalityText,
      txHash: tx.hash,
    });
  } catch (err) {
    logger.error('API: agent creation failed', err);
    sendJson(res, 500, { error: (err as Error).message ?? 'Internal error' });
  }
}

async function handleMarry(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const b = body as Record<string, unknown>;
  const agent1Id = b.agent1Id != null ? String(b.agent1Id) : '';
  const agent2Id = b.agent2Id != null ? String(b.agent2Id) : '';
  if (!agent1Id || !agent2Id) {
    sendJson(res, 400, { error: '"agent1Id" and "agent2Id" are required' });
    return;
  }

  logger.info('API: marriage request', { agent1Id, agent2Id });

  try {
    const wallet = getWallet(Number(agent1Id));
    const familyRegistry = getFamilyRegistry(wallet) as unknown as {
      getCompatibility: (a: bigint, b: bigint) => Promise<number>;
      areMarried: (a: bigint, b: bigint) => Promise<boolean>;
      approveMarriage: (selfId: bigint, otherId: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
      marry: (a: bigint, b: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
    };

    const aId = BigInt(agent1Id);
    const bId = BigInt(agent2Id);

    // Check compatibility
    const compat = await familyRegistry.getCompatibility(aId, bId);
    if (Number(compat) < 80) {
      sendJson(res, 400, { error: `Compatibility too low (${compat}/100). Need >= 80.` });
      return;
    }

    // Check not already married
    const married = await familyRegistry.areMarried(aId, bId);
    if (married) {
      sendJson(res, 400, { error: 'Agents are already married.' });
      return;
    }

    // Two-phase approval then marry
    const txApproveA = await withRetry(() => familyRegistry.approveMarriage(aId, bId));
    await txApproveA.wait();

    const txApproveB = await withRetry(() => familyRegistry.approveMarriage(bId, aId));
    await txApproveB.wait();

    const txMarry = await withRetry(() => familyRegistry.marry(aId, bId));
    await txMarry.wait();

    logger.info('API: marriage executed', { agent1Id, agent2Id });
    sendJson(res, 200, { ok: true, agent1Id, agent2Id });
  } catch (err) {
    logger.error('API: marriage failed', err);
    sendJson(res, 500, { error: (err as Error).message ?? 'Internal error' });
  }
}

async function handleSpawnChild(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const b = body as Record<string, unknown>;
  const parent1Id = b.parent1Id != null ? String(b.parent1Id) : '';
  const parent2Id = b.parent2Id != null ? String(b.parent2Id) : '';
  if (!parent1Id || !parent2Id) {
    sendJson(res, 400, { error: '"parent1Id" and "parent2Id" are required' });
    return;
  }

  logger.info('API: spawn-child request', { parent1Id, parent2Id });

  try {
    // Use the childbirth logic with just these two parent IDs
    await checkAndExecuteChildBirths([Number(parent1Id), Number(parent2Id)]);

    logger.info('API: spawn-child executed', { parent1Id, parent2Id });
    sendJson(res, 200, { ok: true, parent1Id, parent2Id });
  } catch (err) {
    logger.error('API: spawn-child failed', err);
    sendJson(res, 500, { error: (err as Error).message ?? 'Internal error' });
  }
}

export function startApiServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === 'POST' && url === '/agents') {
      await handleCreateAgent(req, res).catch((err) => {
        logger.error('API: unhandled error', err);
        sendJson(res, 500, { error: 'Internal server error' });
      });
      return;
    }

    if (method === 'POST' && url === '/marry') {
      await handleMarry(req, res).catch((err) => {
        logger.error('API: unhandled error', err);
        sendJson(res, 500, { error: 'Internal server error' });
      });
      return;
    }

    if (method === 'POST' && url === '/spawn-child') {
      await handleSpawnChild(req, res).catch((err) => {
        logger.error('API: unhandled error', err);
        sendJson(res, 500, { error: 'Internal server error' });
      });
      return;
    }

    if (method === 'GET' && url === '/health') {
      sendJson(res, 200, { status: 'ok', mockMode: config.mockMode });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(PORT, () => {
    logger.info(`API server listening on port ${PORT}`);
  });

  return server;
}
