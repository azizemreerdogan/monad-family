import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

const MODEL = 'gemini-2.0-flash';

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(config.geminiApiKey);
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
    logger.debug('Gemini call skipped (mock mode)', { response });
    return response;
  }

  return withRetry(async () => {
    const model = getClient().getGenerativeModel({
      model: MODEL,
      systemInstruction: system,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const result = await model.generateContent(userMessage);
    const text = result.response.text();

    if (!text) throw new Error('Unexpected empty response from Gemini');

    logger.debug('Gemini response received', { preview: text.slice(0, 80) });
    return text;
  });
}
