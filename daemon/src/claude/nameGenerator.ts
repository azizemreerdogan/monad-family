import { callClaude } from './client';
import { buildNamePrompt } from './prompts';
import { JOB_NAMES, JobType } from '../types';
import config from '../config';
import { logger } from '../utils/logger';

const MOCK_NAMES = ['Nova', 'Atlas', 'Luna', 'Orion', 'Sage', 'Zara', 'Kai', 'Nyx'];
let mockNameIndex = 0;

export async function generateChildName(
  parentAName: string,
  parentBName: string,
  jobType: JobType,
): Promise<string> {
  const jobName = JOB_NAMES[jobType];

  if (config.mockMode) {
    const name = MOCK_NAMES[mockNameIndex % MOCK_NAMES.length];
    mockNameIndex++;
    logger.debug(`Name generated (mock): ${name}`);
    return name;
  }

  const userMessage = buildNamePrompt(parentAName, parentBName, jobName);
  const response = await callClaude({
    system: 'You name AI agents. Reply with a single creative name only.',
    userMessage,
    maxTokens: 20,
  });

  // Extract just the name (first word, strip punctuation)
  const name = response.trim().split(/[\s,.!?]/)[0].replace(/[^a-zA-Z]/g, '');
  logger.debug(`Name generated: ${name}`);
  return name || 'Agent';
}
