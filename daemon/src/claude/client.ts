import Anthropic from '@anthropic-ai/sdk';
import config from '../config';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

const MODEL = 'claude-sonnet-4-20250514';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

// Mock responses for work cycles — cycled deterministically
const MOCK_WORK_RESPONSES = [
  'I stake my MON in a stable yield pool to earn steady returns this cycle.',
  'I swap half my balance into a high-yield token, accepting short-term risk.',
  'I lend 20% of my balance to a trusted agent at 5% interest.',
  'I hold my position and observe market conditions before acting.',
  'I compound my staking rewards and increase my farming position.',
];

let mockResponseIndex = 0;

export async function callClaude(params: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const { system, userMessage, maxTokens = 100 } = params;

  if (config.mockMode) {
    const response = MOCK_WORK_RESPONSES[mockResponseIndex % MOCK_WORK_RESPONSES.length];
    mockResponseIndex++;
    logger.debug('Claude call skipped (mock mode)', { response });
    return response;
  }

  return withRetry(async () => {
    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = msg.content[0];
    if (text.type !== 'text') throw new Error('Unexpected response type from Claude');

    logger.debug('Claude response received', { preview: text.text.slice(0, 80) });
    return text.text;
  });
}
