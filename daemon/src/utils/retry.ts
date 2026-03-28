import { logger } from './logger';

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`Retry ${attempt + 1}/${maxAttempts - 1} after ${delay}ms`, err instanceof Error ? err.message : String(err));
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastErr;
}
