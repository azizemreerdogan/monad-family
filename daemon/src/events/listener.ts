import { getAgentNFT, getFamilyRegistry, getWorkEngine, getMarketplace } from '../contracts';
import { getProvider } from '../provider';
import { logger } from '../utils/logger';
import { ethers } from 'ethers';
import { EventCallbacks } from '../types';
import config from '../config';

import AgentNFTAbi from '../contracts/abis/AgentNFT.json';
import WorkEngineAbi from '../contracts/abis/WorkEngine.json';
import FamilyRegistryAbi from '../contracts/abis/FamilyRegistry.json';
import MarketplaceAbi from '../contracts/abis/Marketplace.json';

const POLL_INTERVAL_MS = 15_000;
const handles: NodeJS.Timeout[] = [];

interface ContractPollConfig {
  name: string;
  address: string;
  abi: ethers.InterfaceAbi;
  events: { name: string; handler: (log: ethers.LogDescription) => void }[];
}

function startPolling(provider: ethers.JsonRpcProvider, contracts: ContractPollConfig[]): void {
  let lastBlock = 0;

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (lastBlock === 0) {
        // On first poll, only listen from now
        lastBlock = currentBlock;
        return;
      }
      if (currentBlock <= lastBlock) return;

      const fromBlock = lastBlock + 1;
      const toBlock = currentBlock;
      lastBlock = currentBlock;

      for (const contract of contracts) {
        const iface = new ethers.Interface(contract.abi);

        for (const evt of contract.events) {
          const topic = iface.getEvent(evt.name)?.topicHash;
          if (!topic) continue;

          try {
            const logs = await provider.getLogs({
              address: contract.address,
              topics: [topic],
              fromBlock,
              toBlock,
            });

            for (const log of logs) {
              try {
                const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed) evt.handler(parsed);
              } catch {
                // skip unparseable log
              }
            }
          } catch (err) {
            logger.debug(`Event poll error for ${contract.name}.${evt.name}`, err);
          }
        }
      }
    } catch (err) {
      logger.debug('Event poll cycle error', err);
    }
  };

  // Initial poll
  poll();
  const handle = setInterval(poll, POLL_INTERVAL_MS);
  handles.push(handle);
}

export function startEventListeners(callbacks?: EventCallbacks): void {
  // Mock mode: use contract.on() (EventEmitter-based, no RPC needed)
  if (config.mockMode) {
    startMockListeners(callbacks);
    return;
  }

  const provider = getProvider() as ethers.JsonRpcProvider;

  const contracts: ContractPollConfig[] = [
    {
      name: 'AgentNFT',
      address: config.contractAddresses.agentNFT,
      abi: AgentNFTAbi,
      events: [
        {
          name: 'AgentBorn',
          handler: (log) => {
            const { childId, parentAId, parentBId, name } = log.args;
            logger.info(`Event AgentBorn: ${name} (id=${childId}), parents: ${parentAId} + ${parentBId}`);
            callbacks?.onAgentBorn?.(BigInt(childId), BigInt(parentAId), BigInt(parentBId), String(name));
          },
        },
        {
          name: 'AgentRetired',
          handler: (log) => {
            const { agentId, finalBalance } = log.args;
            const balanceMon = parseFloat(ethers.formatEther(finalBalance)).toFixed(3);
            logger.info(`Event AgentRetired: agent ${agentId}, final balance ${balanceMon} MON`);
            callbacks?.onAgentRetired?.(BigInt(agentId), BigInt(finalBalance));
          },
        },
      ],
    },
    {
      name: 'WorkEngine',
      address: config.contractAddresses.workEngine,
      abi: WorkEngineAbi,
      events: [
        {
          name: 'AgentWorked',
          handler: (log) => {
            const { agentId, earned, newAge } = log.args;
            const earnedMon = parseFloat(ethers.formatEther(earned)).toFixed(4);
            logger.info(`Event AgentWorked: agent ${agentId}, earned ${earnedMon} MON, age=${newAge}`);
            if (BigInt(newAge) >= 98n) {
              logger.warn(`Agent ${agentId} approaching retirement (age ${newAge}/100)`);
            }
          },
        },
      ],
    },
    {
      name: 'FamilyRegistry',
      address: config.contractAddresses.familyRegistry,
      abi: FamilyRegistryAbi,
      events: [
        {
          name: 'AgentBonded',
          handler: (log) => {
            const { agentA, agentB, compatibility } = log.args;
            logger.info(`Event AgentBonded: agents ${agentA} + ${agentB}, compatibility=${compatibility}/100`);
            if (Number(compatibility) >= 80) {
              logger.info(`Agents ${agentA} + ${agentB} are eligible for marriage! (compatibility=${compatibility})`);
            }
          },
        },
        {
          name: 'AgentMarried',
          handler: (log) => {
            const { agentA, agentB } = log.args;
            logger.info(`Event AgentMarried: agents ${agentA} + ${agentB} are now married`);
          },
        },
      ],
    },
    {
      name: 'Marketplace',
      address: config.contractAddresses.marketplace,
      abi: MarketplaceAbi,
      events: [
        {
          name: 'AgentListed',
          handler: (log) => {
            const { agentId, price, seller } = log.args;
            const priceMon = parseFloat(ethers.formatEther(price)).toFixed(3);
            logger.info(`Event AgentListed: agent ${agentId} listed for ${priceMon} MON by ${seller}`);
          },
        },
        {
          name: 'AgentSold',
          handler: (log) => {
            const { agentId, price, buyer } = log.args;
            const priceMon = parseFloat(ethers.formatEther(price)).toFixed(3);
            logger.info(`Event AgentSold: agent ${agentId} sold for ${priceMon} MON to ${buyer}`);
            callbacks?.onAgentSold?.(BigInt(agentId), BigInt(price), String(buyer));
          },
        },
      ],
    },
  ];

  startPolling(provider, contracts);
  logger.info(`Event listeners started (polling every ${POLL_INTERVAL_MS / 1000}s)`);
}

// Mock mode: EventEmitter-based listeners (no RPC)
function startMockListeners(callbacks?: EventCallbacks): void {
  const agentNFT = getAgentNFT() as unknown as {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  const familyRegistry = getFamilyRegistry() as unknown as {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  const workEngine = getWorkEngine() as unknown as {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  const marketplace = getMarketplace() as unknown as {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  agentNFT.on('AgentBorn', (childId: unknown, parentAId: unknown, parentBId: unknown, name: unknown) => {
    logger.info(`Event AgentBorn: ${name} (id=${childId}), parents: ${parentAId} + ${parentBId}`);
    callbacks?.onAgentBorn?.(BigInt(childId as number), BigInt(parentAId as number), BigInt(parentBId as number), String(name));
  });

  workEngine.on('AgentWorked', (agentId: unknown, earned: unknown, newAge: unknown) => {
    const earnedMon = parseFloat(ethers.formatEther(earned as bigint)).toFixed(4);
    logger.info(`Event AgentWorked: agent ${agentId}, earned ${earnedMon} MON, age=${newAge}`);
    if (BigInt(newAge as bigint) >= 98n) {
      logger.warn(`Agent ${agentId} approaching retirement (age ${newAge}/100)`);
    }
  });

  agentNFT.on('AgentRetired', (agentId: unknown, finalBalance: unknown) => {
    const balanceMon = parseFloat(ethers.formatEther(finalBalance as bigint)).toFixed(3);
    logger.info(`Event AgentRetired: agent ${agentId}, final balance ${balanceMon} MON`);
    callbacks?.onAgentRetired?.(BigInt(agentId as number), BigInt(finalBalance as number));
  });

  familyRegistry.on('AgentBonded', (agentA: unknown, agentB: unknown, compatibility: unknown) => {
    logger.info(`Event AgentBonded: agents ${agentA} + ${agentB}, compatibility=${compatibility}/100`);
    if (Number(compatibility) >= 80) {
      logger.info(`Agents ${agentA} + ${agentB} are eligible for marriage! (compatibility=${compatibility})`);
    }
  });

  familyRegistry.on('AgentMarried', (agentA: unknown, agentB: unknown) => {
    logger.info(`Event AgentMarried: agents ${agentA} + ${agentB} are now married`);
  });

  marketplace.on('AgentListed', (agentId: unknown, price: unknown, seller: unknown) => {
    const priceMon = parseFloat(ethers.formatEther(price as bigint)).toFixed(3);
    logger.info(`Event AgentListed: agent ${agentId} listed for ${priceMon} MON by ${seller}`);
  });

  marketplace.on('AgentSold', (agentId: unknown, price: unknown, buyer: unknown) => {
    const priceMon = parseFloat(ethers.formatEther(price as bigint)).toFixed(3);
    logger.info(`Event AgentSold: agent ${agentId} sold for ${priceMon} MON to ${buyer}`);
    callbacks?.onAgentSold?.(BigInt(agentId as number), BigInt(price as number), String(buyer));
  });

  logger.info('Event listeners started (mock mode, EventEmitter-based)');
}

export function stopEventListeners(): void {
  for (const h of handles) clearInterval(h);
  handles.length = 0;
}
