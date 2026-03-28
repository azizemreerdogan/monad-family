import { logger } from '../utils/logger';

const activeAgents = new Set<number>();

export function initActiveAgents(agentIds: number[]): void {
  for (const id of agentIds) activeAgents.add(id);
  logger.debug(`Lifecycle: initialized with ${activeAgents.size} agents`);
}

export function addAgent(id: number): void {
  if (activeAgents.has(id)) return;
  activeAgents.add(id);
  logger.info(`Lifecycle: agent ${id} added (total: ${activeAgents.size})`);
}

export function removeAgent(id: number): void {
  if (!activeAgents.has(id)) return;
  activeAgents.delete(id);
  logger.info(`Lifecycle: agent ${id} removed (total: ${activeAgents.size})`);
}

export function getActiveAgentIds(): number[] {
  return Array.from(activeAgents);
}

export function isActive(id: number): boolean {
  return activeAgents.has(id);
}
