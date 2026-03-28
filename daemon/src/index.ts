import { validate } from './config';
import config from './config';
import { logger } from './utils/logger';
import { startEventListeners } from './events/listener';
import { startScheduler, stopScheduler, onAgentAdded, onAgentRemoved } from './agent/scheduler';
import { startMarketplaceMonitor } from './agent/marketplace';
import { startApiServer } from './api/server';

async function main(): Promise<void> {
  logger.info('MonadFamily daemon starting', {
    mockMode: config.mockMode,
    agentIds: config.agentIds,
    workIntervalMs: config.workIntervalMs,
    marriageCheckIntervalMs: config.marriageCheckIntervalMs,
    childCheckIntervalMs: config.childCheckIntervalMs,
  });

  validate();

  // Start event listeners with lifecycle callbacks
  startEventListeners({
    onAgentBorn: (childId) => {
      onAgentAdded(Number(childId));
    },
    onAgentRetired: (agentId) => {
      onAgentRemoved(Number(agentId));
    },
    onAgentSold: (agentId) => {
      onAgentRemoved(Number(agentId));
    },
  });

  // Start the unified scheduler (work + marriage + child + retirement)
  startScheduler(config.agentIds);

  // Start marketplace monitor if enabled
  if (config.enableMarketplace && config.agentIds.length > 0) {
    startMarketplaceMonitor(config.agentIds[0]);
  }

  // Start HTTP API server
  startApiServer();

  logger.info(`Daemon running for agents: [${config.agentIds.join(', ')}]`);
}

process.on('SIGINT', () => {
  logger.info('Daemon shutting down (SIGINT)');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Daemon shutting down (SIGTERM)');
  stopScheduler();
  process.exit(0);
});

main().catch((err) => {
  logger.error('Fatal daemon error', err);
  process.exit(1);
});
