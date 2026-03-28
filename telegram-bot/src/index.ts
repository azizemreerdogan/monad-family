import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';

// ─── Config ────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');

const DAEMON_URL = process.env.DAEMON_URL ?? 'http://localhost:3000';
const INDEXER_URL = process.env.INDEXER_URL ?? 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────────────────────────────

type JobType = 0 | 1 | 2;

type WizardStep =
  | 'name'
  | 'jobType'
  | 'riskScore'
  | 'patience'
  | 'socialScore'
  | 'confirm';

interface WizardState {
  step: WizardStep;
  name?: string;
  jobType?: JobType;
  riskScore?: number;
  patience?: number;
  socialScore?: number;
}

interface CreateAgentRequest {
  name: string;
  jobType: JobType;
  riskScore: number;
  patience: number;
  socialScore: number;
}

interface CreateAgentResponse {
  agentId: number;
  name: string;
  jobType: JobType;
  riskScore: number;
  patience: number;
  socialScore: number;
  personalityCID: string;
  personalityText: string;
  txHash: string;
}

interface IndexerAgent {
  id: string;
  name: string;
  jobType: 'trader' | 'farmer' | 'lender';
  riskScore: number;
  patienceScore: number;
  socialScore: number;
  age: number;
  balance: string;
  retired: boolean;
  lastThought: string;
  personalityCID: string;
}

interface AgentProfileResponse {
  agent: IndexerAgent;
  family: {
    partner: IndexerAgent | null;
    children: IndexerAgent[];
    parents: IndexerAgent[];
  };
  history: Array<{ id: string; type: string; data: string; timestamp: string }>;
}

interface LeaderboardResponse {
  agents: IndexerAgent[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const JOB_LABELS: Record<JobType, string> = {
  0: '📈 Trader',
  1: '🌾 Farmer',
  2: '🏦 Lender',
};

const JOB_EMOJI: Record<string, string> = {
  trader: '📈',
  farmer: '🌾',
  lender: '🏦',
};

function balanceToMon(wei: string): string {
  return (parseFloat(wei) / 1e18).toFixed(4) + ' MON';
}

function traitBar(value: number): string {
  const filled = Math.round(value / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${value}/100`;
}

// ─── API calls ──────────────────────────────────────────────────────────────

async function createAgent(data: CreateAgentRequest): Promise<CreateAgentResponse> {
  const res = await fetch(`${DAEMON_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<CreateAgentResponse>;
}

async function getLeaderboard(): Promise<IndexerAgent[]> {
  const res = await fetch(`${INDEXER_URL}/leaderboard`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as LeaderboardResponse;
  return data.agents;
}

async function getAgent(id: string): Promise<AgentProfileResponse> {
  const res = await fetch(`${INDEXER_URL}/agents/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AgentProfileResponse>;
}

async function checkDaemonHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Wizard session store ───────────────────────────────────────────────────

const sessions = new Map<number, WizardState>();

// ─── Bot ────────────────────────────────────────────────────────────────────

const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start((ctx) => {
  const name = ctx.from?.first_name ?? 'there';
  ctx.replyWithMarkdownV2(
    `*Welcome to MonadFamily* 🧬\n\n` +
    `AI agents live, work, marry, and build dynasties on the Monad blockchain\\.\n\n` +
    `*Commands:*\n` +
    `/create — Spawn a new agent\n` +
    `/agent \\<id\\> — View agent profile\n` +
    `/leaderboard — Top agents by balance\n` +
    `/status — Check API status\n\n` +
    `Hello, ${escMd(name)}\\! Ready to build your dynasty?`
  );
});

// /status
bot.command('status', async (ctx) => {
  const alive = await checkDaemonHealth();
  ctx.reply(alive
    ? '✅ Daemon API is online and ready.'
    : '❌ Daemon API is unreachable. Make sure the daemon is running on ' + DAEMON_URL
  );
});

// /leaderboard
bot.command('leaderboard', async (ctx) => {
  const msg = await ctx.reply('⏳ Fetching leaderboard…');
  try {
    const agents = await getLeaderboard();
    if (!agents.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 'No agents found yet.');
      return;
    }

    const lines = agents.map((a, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const emoji = JOB_EMOJI[a.jobType] ?? '🤖';
      const status = a.retired ? ' (retired)' : '';
      return `${medal} ${emoji} *${escMd(a.name)}*${escMd(status)} — ${escMd(balanceToMon(a.balance))}`;
    });

    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, undefined,
      `🏆 *Leaderboard*\n\n${lines.join('\n')}`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (e) {
    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, undefined,
      `❌ Failed to load leaderboard: ${(e as Error).message}`
    );
  }
});

// /agent <id>
bot.command('agent', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const id = parts[1];
  if (!id) {
    ctx.reply('Usage: /agent <id>');
    return;
  }

  const msg = await ctx.reply(`⏳ Loading agent #${id}…`);
  try {
    const { agent, family } = await getAgent(id);
    const emoji = JOB_EMOJI[agent.jobType] ?? '🤖';
    const status = agent.retired ? '💀 Retired' : '✅ Active';

    const familyLines: string[] = [];
    if (family.partner) familyLines.push(`💑 Partner: ${escMd(family.partner.name)}`);
    if (family.children.length) familyLines.push(`👶 Children: ${family.children.map(c => escMd(c.name)).join(', ')}`);
    if (family.parents.length) familyLines.push(`👪 Parents: ${family.parents.map(p => escMd(p.name)).join(', ')}`);

    const text = [
      `${emoji} *${escMd(agent.name)}* \\(#${escMd(id)}\\)`,
      ``,
      `${status} \\| Age: ${agent.age} \\| ${escMd(balanceToMon(agent.balance))}`,
      ``,
      `*Traits:*`,
      `Risk:     ${escMd(traitBar(agent.riskScore))}`,
      `Patience: ${escMd(traitBar(agent.patienceScore))}`,
      `Social:   ${escMd(traitBar(agent.socialScore))}`,
      ...(familyLines.length ? ['', '*Family:*', ...familyLines] : []),
      ...(agent.lastThought ? ['', `*Last thought:*`, `_${escMd(truncate(agent.lastThought, 200))}_`] : []),
    ].join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, text, {
      parse_mode: 'MarkdownV2',
    });
  } catch (e) {
    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, undefined,
      `❌ Could not load agent #${id}: ${(e as Error).message}`
    );
  }
});

// ─── /create wizard ──────────────────────────────────────────────────────────

bot.command('create', (ctx) => {
  sessions.set(ctx.from.id, { step: 'name' });
  ctx.reply(
    '🧬 *Create a New Agent*\n\nStep 1/5 — What is your agent\'s name?',
    { parse_mode: 'Markdown' }
  );
});

// Handle wizard text input
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const state = sessions.get(userId);
  if (!state) return; // not in wizard

  const text = ctx.message.text.trim();

  switch (state.step) {
    // ── Step 1: Name ───────────────────────────────────────────────────────
    case 'name': {
      if (!text || text.startsWith('/')) {
        ctx.reply('Please enter a valid name for your agent.');
        return;
      }
      state.name = text;
      state.step = 'jobType';
      sessions.set(userId, state);

      ctx.reply(
        `Great name! 🎉\n\nStep 2/5 — Choose a job for *${text}*:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📈 Trader', 'job:0')],
            [Markup.button.callback('🌾 Farmer', 'job:1')],
            [Markup.button.callback('🏦 Lender', 'job:2')],
          ]),
        }
      );
      break;
    }

    // ── Step 3: Risk score ─────────────────────────────────────────────────
    case 'riskScore': {
      const val = parseInt(text, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        ctx.reply('Please enter a number between 0 and 100.');
        return;
      }
      state.riskScore = val;
      state.step = 'patience';
      sessions.set(userId, state);

      ctx.reply(
        `Step 4/5 — *Patience* (0–100)\n\n` +
        `How patient is ${state.name}? Higher = waits longer for better outcomes.`,
        { parse_mode: 'Markdown' }
      );
      break;
    }

    // ── Step 4: Patience ───────────────────────────────────────────────────
    case 'patience': {
      const val = parseInt(text, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        ctx.reply('Please enter a number between 0 and 100.');
        return;
      }
      state.patience = val;
      state.step = 'socialScore';
      sessions.set(userId, state);

      ctx.reply(
        `Step 5/5 — *Social Score* (0–100)\n\n` +
        `How social is ${state.name}? Higher = more likely to bond and marry.`,
        { parse_mode: 'Markdown' }
      );
      break;
    }

    // ── Step 5: Social score → confirm ────────────────────────────────────
    case 'socialScore': {
      const val = parseInt(text, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        ctx.reply('Please enter a number between 0 and 100.');
        return;
      }
      state.socialScore = val;
      state.step = 'confirm';
      sessions.set(userId, state);

      const jobLabel = JOB_LABELS[state.jobType!];
      const summary =
        `📋 *Agent Summary*\n\n` +
        `*Name:* ${state.name}\n` +
        `*Job:* ${jobLabel}\n` +
        `*Risk Score:* ${traitBar(state.riskScore!)}\n` +
        `*Patience:*   ${traitBar(state.patience!)}\n` +
        `*Social:*     ${traitBar(val)}\n\n` +
        `Ready to mint this agent on-chain?`;

      ctx.reply(summary, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Mint Agent', 'confirm:yes'),
            Markup.button.callback('❌ Cancel', 'confirm:no'),
          ],
        ]),
      });
      break;
    }

    case 'confirm':
    case 'jobType':
      // These steps are handled via inline keyboard callbacks
      break;
  }
});

// ─── Inline keyboard callbacks ────────────────────────────────────────────────

// Job selection
bot.action(/^job:(\d)$/, (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const state = sessions.get(userId);
  if (!state || state.step !== 'jobType') return;

  const jobType = parseInt(ctx.match[1], 10) as JobType;
  state.jobType = jobType;
  state.step = 'riskScore';
  sessions.set(userId, state);

  ctx.answerCbQuery();
  ctx.editMessageText(
    `Job set to ${JOB_LABELS[jobType]} ✓\n\n` +
    `Step 3/5 — *Risk Score* (0–100)\n\n` +
    `How risk-tolerant is ${state.name}? Higher = bolder trades and decisions.`,
    { parse_mode: 'Markdown' }
  );
});

// Confirm: yes → mint
bot.action('confirm:yes', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const state = sessions.get(userId);
  if (!state || state.step !== 'confirm') return;

  sessions.delete(userId);
  await ctx.answerCbQuery('Minting…');
  await ctx.editMessageText('⏳ Minting your agent on-chain… This may take a moment.');

  try {
    const agent = await createAgent({
      name: state.name!,
      jobType: state.jobType!,
      riskScore: state.riskScore!,
      patience: state.patience!,
      socialScore: state.socialScore!,
    });

    const jobLabel = JOB_LABELS[agent.jobType];
    const shortTx = agent.txHash ? `\`${agent.txHash.slice(0, 10)}…${agent.txHash.slice(-8)}\`` : 'N/A';

    await ctx.editMessageText(
      `🎉 *Agent Minted Successfully\\!*\n\n` +
      `*${escMd(agent.name)}* is now alive on Monad\\!\n\n` +
      `🆔 Agent ID: \`${agent.agentId}\`\n` +
      `💼 Job: ${escMd(jobLabel)}\n` +
      `⛓ Tx: ${shortTx}\n\n` +
      `Use /agent ${agent.agentId} to track their life\\.`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (e) {
    await ctx.editMessageText(
      `❌ *Minting failed*\n\n${escMd((e as Error).message)}`,
      { parse_mode: 'MarkdownV2' }
    );
  }
});

// Confirm: no → cancel
bot.action('confirm:no', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) sessions.delete(userId);
  ctx.answerCbQuery('Cancelled');
  ctx.editMessageText('❌ Agent creation cancelled. Use /create to start again.');
});

// ─── Utils ───────────────────────────────────────────────────────────────────

/** Escape special characters for MarkdownV2 */
function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── Start ───────────────────────────────────────────────────────────────────

bot.launch().then(() => {
  console.log('🤖 MonadFamily Telegram Bot is running');
}).catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
