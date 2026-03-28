import config from '../config';
import { runAgent } from './runner';
import { checkAndExecuteMarriages } from './marriage';
import { checkAndExecuteChildBirths } from './childbirth';
import { checkRetirements } from './retirement';
import { initActiveAgents, getActiveAgentIds, addAgent, removeAgent } from './lifecycle';
import { logger } from '../utils/logger';

const handles: NodeJS.Timeout[] = [];
const agentWorkHandles = new Map<number, NodeJS.Timeout>();

function scheduleAgentWork(id: number, staggerMs: number): void {
  const outer = setTimeout(() => {
    logger.info(`Scheduler: agent ${id} starting first work cycle`);
    runAgent(id, getActiveAgentIds()).catch((err) => logger.error(`Scheduler: agent ${id} unhandled`, err));

    const interval = setInterval(() => {
      runAgent(id, getActiveAgentIds()).catch((err) => logger.error(`Scheduler: agent ${id} unhandled`, err));
    }, config.workIntervalMs);

    agentWorkHandles.set(id, interval);
    handles.push(interval);
  }, staggerMs);

  handles.push(outer);
}

export function startScheduler(agentIds: number[]): void {
  if (agentIds.length === 0) {
    logger.warn('Scheduler: no agent IDs configured, nothing to schedule');
    return;
  }

  initActiveAgents(agentIds);

  // Schedule work cycles for each agent with stagger
  agentIds.forEach((id, i) => {
    scheduleAgentWork(id, i * 15_000);
  });

  // Marriage check — start after 60s delay to let compatibility build
  const marriageDelay = setTimeout(() => {
    const marriageInterval = setInterval(() => {
      const ids = getActiveAgentIds();
      checkAndExecuteMarriages(ids).catch((err) => logger.error('Scheduler: marriage check failed', err));
    }, config.marriageCheckIntervalMs);
    handles.push(marriageInterval);
  }, 60_000);
  handles.push(marriageDelay);

  // Child birth check — start after 120s delay to let marriages form
  const childDelay = setTimeout(() => {
    const childInterval = setInterval(() => {
      const ids = getActiveAgentIds();
      checkAndExecuteChildBirths(ids).catch((err) => logger.error('Scheduler: child birth check failed', err));
    }, config.childCheckIntervalMs);
    handles.push(childInterval);
  }, 120_000);
  handles.push(childDelay);

  // Retirement check — runs every 3 minutes
  const retirementInterval = setInterval(() => {
    const ids = getActiveAgentIds();
    checkRetirements(ids).catch((err) => logger.error('Scheduler: retirement check failed', err));
  }, 180_000);
  handles.push(retirementInterval);

  logger.info(
    `Scheduler: ${agentIds.length} agent(s) scheduled | ` +
    `work=${config.workIntervalMs}ms, marriage=${config.marriageCheckIntervalMs}ms, ` +
    `child=${config.childCheckIntervalMs}ms, retirement=180000ms`
  );
}

export function onAgentAdded(id: number): void {
  addAgent(id);
  const stagger = getActiveAgentIds().length * 15_000;
  scheduleAgentWork(id, stagger);
  logger.info(`Scheduler: new agent ${id} added to work rotation`);
}

export function onAgentRemoved(id: number): void {
  removeAgent(id);
  const handle = agentWorkHandles.get(id);
  if (handle) {
    clearInterval(handle);
    agentWorkHandles.delete(id);
  }
  logger.info(`Scheduler: agent ${id} removed from work rotation`);
}

export function stopScheduler(): void {
  for (const h of handles) clearTimeout(h);
  for (const h of agentWorkHandles.values()) clearInterval(h);
  handles.length = 0;
  agentWorkHandles.clear();
  logger.info('Scheduler: stopped');
}
