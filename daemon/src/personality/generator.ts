import { callClaude } from '../claude/client';
import { buildPersonalityPrompt } from '../claude/prompts';
import { uploadPersonality } from '../ipfs/client';
import { PersonalityResult } from '../types';
import { logger } from '../utils/logger';

export async function generatePersonality(
  parentAText: string,
  parentBText: string,
  childTraits: { riskScore: number; patience: number; socialScore: number; jobType: number },
): Promise<PersonalityResult> {
  logger.debug('Generating personality for new agent', childTraits);

  const userMessage = buildPersonalityPrompt(parentAText, parentBText, childTraits);

  const personalityText = await callClaude({
    system: 'You are a creative writer designing personalities for AI blockchain agents.',
    userMessage,
    maxTokens: 300,
  });

  const cid = await uploadPersonality(personalityText);

  logger.info('Personality generated and uploaded', { cid, preview: personalityText.slice(0, 80) });

  return { personalityText, cid };
}
