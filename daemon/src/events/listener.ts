import { getAgentNFT, getFamilyRegistry, getWorkEngine, getMarketplace } from '../contracts';
import { logger } from '../utils/logger';
import { ethers } from 'ethers';
import { EventCallbacks } from '../types';

export function startEventListeners(callbacks?: EventCallbacks): void {
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

  // AgentNFT events
  agentNFT.on('AgentBorn', (childId: unknown, parentAId: unknown, parentBId: unknown, name: unknown) => {
    logger.info(`Event AgentBorn: ${name} (id=${childId}), parents: ${parentAId} + ${parentBId}`);
    callbacks?.onAgentBorn?.(BigInt(childId as number), BigInt(parentAId as number), BigInt(parentBId as number), String(name));
  });

  // WorkEngine events
  workEngine.on('AgentWorked', (agentId: unknown, earned: unknown, newAge: unknown) => {
    const earnedMon = parseFloat(ethers.formatEther(earned as bigint)).toFixed(4);
    logger.info(`Event AgentWorked: agent ${agentId}, earned ${earnedMon} MON, age=${newAge}`);

    if (BigInt(newAge as bigint) >= 98n) {
      logger.warn(`Agent ${agentId} approaching retirement (age ${newAge}/100)`);
    }
  });

  workEngine.on('AgentRetired', (agentId: unknown, finalBalance: unknown) => {
    const balanceMon = parseFloat(ethers.formatEther(finalBalance as bigint)).toFixed(3);
    logger.info(`Event AgentRetired: agent ${agentId}, final balance ${balanceMon} MON`);
    callbacks?.onAgentRetired?.(BigInt(agentId as number), BigInt(finalBalance as number));
  });

  // FamilyRegistry events
  familyRegistry.on('AgentBonded', (agentA: unknown, agentB: unknown, compatibility: unknown) => {
    logger.info(`Event AgentBonded: agents ${agentA} + ${agentB}, compatibility=${compatibility}/100`);

    if (Number(compatibility) >= 80) {
      logger.info(`Agents ${agentA} + ${agentB} are eligible for marriage! (compatibility=${compatibility})`);
    }
  });

  familyRegistry.on('AgentMarried', (agentA: unknown, agentB: unknown) => {
    logger.info(`Event AgentMarried: agents ${agentA} + ${agentB} are now married`);
  });

  // Marketplace events
  marketplace.on('AgentListed', (agentId: unknown, price: unknown, seller: unknown) => {
    const priceMon = parseFloat(ethers.formatEther(price as bigint)).toFixed(3);
    logger.info(`Event AgentListed: agent ${agentId} listed for ${priceMon} MON by ${seller}`);
  });

  marketplace.on('AgentSold', (agentId: unknown, price: unknown, buyer: unknown) => {
    const priceMon = parseFloat(ethers.formatEther(price as bigint)).toFixed(3);
    logger.info(`Event AgentSold: agent ${agentId} sold for ${priceMon} MON to ${buyer}`);
    callbacks?.onAgentSold?.(BigInt(agentId as number), BigInt(price as number), String(buyer));
  });

  logger.info('Event listeners started (AgentNFT + WorkEngine + FamilyRegistry + Marketplace)');
}
