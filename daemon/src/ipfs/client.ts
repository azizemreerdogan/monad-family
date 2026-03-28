import config from '../config';
import { SEED_AGENTS } from '../seeds/agents';
import { ipfsCache } from './cache';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

// Build a CID → text map from seed agents for placeholder/mock CIDs
const SEED_PERSONALITIES = new Map<string, string>(
  SEED_AGENTS.flatMap((a) => [
    [`mock-cid-${a.id}`, a.personalityText],
    [`placeholder-${a.id}`, a.personalityText],
  ]),
);

export async function uploadPersonality(text: string): Promise<string> {
  if (config.mockMode) {
    const fakeCid = `mock-cid-${Date.now()}`;
    ipfsCache.set(fakeCid, text);
    logger.debug('IPFS upload skipped (mock mode)', { fakeCid });
    return fakeCid;
  }

  return withRetry(async () => {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.pinataJwt}`,
      },
      body: JSON.stringify({ pinataContent: { content: text } }),
    });

    if (!res.ok) {
      throw new Error(`Pinata upload failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { IpfsHash: string };
    logger.debug('IPFS upload success', { cid: data.IpfsHash });
    return data.IpfsHash;
  });
}

export async function fetchPersonality(cid: string): Promise<string> {
  // Check in-memory cache first
  const cached = ipfsCache.get(cid);
  if (cached) return cached;

  // Serve seed/placeholder personalities without hitting IPFS
  const seedText = SEED_PERSONALITIES.get(cid);
  if (seedText) {
    ipfsCache.set(cid, seedText);
    return seedText;
  }

  if (config.mockMode) {
    const text = 'You are an AI agent on the Monad blockchain. Execute your strategy.';
    ipfsCache.set(cid, text);
    return text;
  }

  return withRetry(async () => {
    const url = `${config.ipfsGateway}/${cid}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`IPFS fetch failed: ${res.status} ${res.statusText} (${url})`);
    }

    const data = (await res.json()) as { content?: string } | string;
    const text = typeof data === 'string' ? data : (data.content ?? JSON.stringify(data));

    ipfsCache.set(cid, text);
    logger.debug('IPFS fetch success', { cid });
    return text;
  });
}
