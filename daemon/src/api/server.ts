import http from 'http';
import { getAgentNFT } from '../contracts';
import { callClaude } from '../claude/client';
import { buildNewAgentPersonalityPrompt } from '../claude/prompts';
import { uploadPersonality } from '../ipfs/client';
import { onAgentAdded } from '../agent/scheduler';
import { logger } from '../utils/logger';
import config from '../config';
import { JobType } from '../types';

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

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
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

export function startApiServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'POST' && url === '/agents') {
      await handleCreateAgent(req, res).catch((err) => {
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
