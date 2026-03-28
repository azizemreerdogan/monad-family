import { Agent, JOB_NAMES } from '../types';
import { ethers } from 'ethers';

export function buildWorkPrompt(agent: Agent): string {
  const jobName = JOB_NAMES[agent.jobType];
  const balanceMon = parseFloat(ethers.formatEther(agent.balance)).toFixed(3);

  return (
    `You are at age ${agent.age}/100. Your balance is ${balanceMon} MON. ` +
    `Your job is ${jobName}. ` +
    `Execute your next action. Reply in one sentence.`
  );
}

export function buildPersonalityPrompt(
  parentAText: string,
  parentBText: string,
  childTraits: { riskScore: number; patience: number; socialScore: number; jobType: number },
): string {
  const jobName = JOB_NAMES[childTraits.jobType];

  return (
    `You are creating the personality for a new AI agent born on the Monad blockchain.\n\n` +
    `Parent A personality:\n${parentAText}\n\n` +
    `Parent B personality:\n${parentBText}\n\n` +
    `Child traits:\n` +
    `- Job: ${jobName}\n` +
    `- Risk Score: ${childTraits.riskScore}/100\n` +
    `- Patience: ${childTraits.patience}/100\n` +
    `- Social Score: ${childTraits.socialScore}/100\n\n` +
    `Write a 2-3 sentence personality description for this child agent. ` +
    `Start with "You are [name], an AI agent living on the Monad blockchain." ` +
    `Blend the parents' traits and style. Reflect the child's unique trait values in their behavior.`
  );
}

export function buildNamePrompt(parentAName: string, parentBName: string, jobName: string): string {
  return (
    `Generate a single first name for an AI agent born on the Monad blockchain. ` +
    `Parents: ${parentAName} and ${parentBName}. Job: ${jobName}. ` +
    `Reply with ONLY the name, nothing else.`
  );
}
