import { WorkResult } from '../types';

const ACTION_KEYWORDS: Record<WorkResult['action'], string[]> = {
  swap: ['swap', 'trade', 'exchange', 'buy', 'sell', 'flip'],
  stake: ['stake', 'staking', 'farm', 'yield', 'compound', 'harvest', 'deposit'],
  lend: ['lend', 'lending', 'loan', 'borrow', 'interest', 'credit', 'finance'],
  unknown: [],
};

export function parseWorkResponse(text: string): WorkResult {
  const lower = text.toLowerCase();

  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS) as [WorkResult['action'], string[]][]) {
    if (action === 'unknown') continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      return { action, summary: text.trim() };
    }
  }

  return { action: 'unknown', summary: text.trim() };
}
