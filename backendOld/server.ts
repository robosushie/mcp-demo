// server.ts – MCP Chat backend (multi‑step tool loop)
// --------------------------------------------------
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI, { ChatCompletionTool, ChatCompletionMessageParam } from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  fetchMCPServers,
  fetchMCPServerDetails,
  recommendMCPServersWithAI,
  normalizeServerConfig,
} from './mcp-server-utils.js';

dotenv.config();

// --------------------------------------------------
// Singletons & constants
// --------------------------------------------------
const PORT = process.env.PORT || 3001;
const MAX_CONTEXT_TOKENS    = 120_000;          // keep well below 128k limit
const APPROX_TOKENS_PER_MSG = 2000;             // fallback if we cannot estimate
const app  = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const activeMCPConnections = new Map<string, Client>();

// -------- approximate token counting (very rough) --------
const BYTES_PER_TOKEN = 3; // a bit safer – assume ~3 bytes per token
function strTokens(str: string): number {
  // Fast‑path for extremely long strings: approximate without .length overflow
  const len = Math.min(str.length, 1_000_000); // cap to keep calc cheap
  return Math.ceil(len / BYTES_PER_TOKEN);
}

/**
 * Clip very large string contents (common with page scrapes) so a single
 * message can never ruin the context length.
 */
const MAX_SINGLE_MSG_TOKENS = 8_000; // ~24k bytes when BYTES_PER_TOKEN = 3
function clipMessage(msg: ChatCompletionMessageParam): void {
  if (typeof msg.content === 'string') {
    if (strTokens(msg.content) > MAX_SINGLE_MSG_TOKENS) {
      const keep = MAX_SINGLE_MSG_TOKENS * BYTES_PER_TOKEN;
      msg.content = msg.content.slice(0, keep) + '…[truncated]';
    }
  }
}

function msgTokens(msg: ChatCompletionMessageParam): number {
  if (msg.content === null) return 4;
  if (typeof msg.content === 'string') return strTokens(msg.content);
  return strTokens(JSON.stringify(msg.content));
}
function totalTokens(messages: ChatCompletionMessageParam[]): number {
  return messages.reduce((sum, m) => sum + msgTokens(m), 0);
}

/**
 * Trim conversation so that total token estimate ≤ MAX_CONTEXT_TOKENS.
 * Strategy:  (1) Clip individual oversize messages.
 *            (2) Drop oldest *non‑system* messages until under cap.
 */
function pruneConversation(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const pruned: ChatCompletionMessageParam[] = [];

  // First, copy messages while clipping giant contents
  for (const m of messages) {
    const clone: ChatCompletionMessageParam = { ...m, content: m.content } as any;
    clipMessage(clone);
    pruned.push(clone);
  }

  // Then drop oldest non‑system messages until under budget
  while (totalTokens(pruned) > MAX_CONTEXT_TOKENS && pruned.length > 1) {
    const idx = pruned.findIndex((m) => m.role !== 'system');
    if (idx === -1) break; // can't drop system prompts
    pruned.splice(idx, 1);
  }

  return pruned;
}

// --------------------------------------------------
// Helper utilities
// --------------------------------------------------
function extractServerId(key: string, sessionId: string): string {
  const prefix = `${sessionId}-`;
  if (!key.startsWith(prefix)) throw new Error(`Key ${key} missing prefix`);
  return key.slice(prefix.length);
}

async function connectToMCPServer(serverId: string): Promise<Client> {
  const server = await fetchMCPServerDetails(serverId);
  if (!server) throw new Error(`MCP server ${serverId} not found`);

  const cfg = normalizeServerConfig(server);
  if (!cfg.command || !cfg.args) throw new Error(`MCP server ${serverId} mis‑configured`);

  const transport = new StdioClientTransport({
    command: cfg.command,
    args: cfg.args,
    env: { ...process.env, ...(cfg.env || {}) } as Record<string, string>,
  });

  const client = new Client(
    { name: `mcp-chat-client-${serverId}`, version: '1.0.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

// --------------------------------------------------
// REST endpoints
// --------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeConnections: activeMCPConnections.size });
});

app.get('/api/mcp/servers', async (req, res) => {
  try {
    const { category, limit = '20' } = req.query;
    const servers = await fetchMCPServers({
      category: category as string,
      limit: parseInt(limit as string, 10),
    });
    res.json({ servers, total: servers.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

app.post('/api/mcp/recommend', async (req, res) => {
  try {
    const { query, useAI = true } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    let ids: string[] = [];
    if (useAI) ids = await recommendMCPServersWithAI(query, openai);
    if (ids.length === 0) {
      const fallback = await fetchMCPServers({ query, limit: 3 });
      ids = fallback.map((s) => s.id);
    }

    const recs = await Promise.all(
      ids.map(async (id) => {
        const srv = await fetchMCPServerDetails(id);
        return srv ? normalizeServerConfig(srv) : null;
      }),
    );

    res.json({ recommendations: recs.filter(Boolean), query, source: useAI ? 'ai' : 'search' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to recommend MCP servers' });
  }
});

app.post('/api/mcp/connect', async (req, res) => {
  try {
    const { sessionId, serverIds } = req.body;
    if (!sessionId || !Array.isArray(serverIds)) {
      return res.status(400).json({ error: 'sessionId and serverIds are required' });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];
    for (const id of serverIds) {
      const key = `${sessionId}-${id}`;
      if (activeMCPConnections.has(key)) {
        results.push({ id, status: 'already connected' });
        continue;
      }
      try {
        const client = await connectToMCPServer(id);
        activeMCPConnections.set(key, client);
        results.push({ id, status: 'connected' });
      } catch (e: any) {
        console.error(e);
        results.push({ id, status: 'failed', error: e.message });
      }
    }
    res.json({ connectedServers: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect to MCP servers' });
  }
});

app.post('/api/mcp/tools', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const tools: Array<{ serverId: string; name: string; description?: string; inputSchema?: any }> = [];
    for (const [key, client] of activeMCPConnections) {
      if (!key.startsWith(sessionId)) continue;
      const serverId = extractServerId(key, sessionId);
      const { tools: svTools } = await client.listTools();
      svTools.forEach((t) => tools.push({ serverId, name: t.name, description: t.description, inputSchema: t.inputSchema || {} }));
    }
    res.json({ tools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// --------------------------------------------------
// Multi‑step chat endpoint (loops until no tool‑calls)
// --------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { sessionId, messages, useMCP = true, maxTurns = 6 } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'sessionId and messages are required' });
    }

    // 1) Build OpenAI "tools" list
    const toolsList: ChatCompletionTool[] = [];
    if (useMCP) {
      for (const [key, client] of activeMCPConnections) {
        if (!key.startsWith(`${sessionId}-`)) continue;
        const serverId = extractServerId(key, sessionId);
        const { tools: svTools } = await client.listTools();
        for (const t of svTools) {
          toolsList.push({
            type: 'function',
            function: {
              name: `${serverId}_${t.name}`,
              description: t.description || '',
              parameters: t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: 'object', properties: {} },
            },
          });
        }
      }
    }

    // 2) Conversation loop
    let convo: ChatCompletionMessageParam[] = [...messages];
    const allToolCalls: any[]   = [];
    const allToolResults: any[] = [];
    let lastAssistantMsg: any   = null;

    for (let turn = 0; turn < maxTurns; turn++) {
        convo = pruneConversation(convo);

      const completion = await openai.chat.completions.create({ model: 'gpt-4-turbo-preview', messages: convo, tools: toolsList, tool_choice: 'auto' });
      const assistant = completion.choices[0].message;

      if (assistant.tool_calls?.length) {
        // Record planning step
        convo.push({ role: 'assistant', content: null, tool_calls: assistant.tool_calls });
        allToolCalls.push(...assistant.tool_calls);

        // Execute each tool call
        for (const call of assistant.tool_calls) {
          if (!call.function) continue;
          const fullName   = call.function.name;
          const rawArgs    = call.function.arguments;
          const args       = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
          const [serverId, ...fnParts] = fullName.split('_');
          const fnName     = fnParts.join('_');
          const clientKey  = `${sessionId}-${serverId}`;
          const client     = activeMCPConnections.get(clientKey);

          let resultContent: any;
          if (client) {
            try {
              const result = await client.callTool({ name: fnName, arguments: args });
              resultContent = result.content;
            } catch (e: any) {
              resultContent = { error: e.message };
            }
          } else {
            resultContent = { error: `MCP server ${serverId} not connected` };
          }

          const toolMsg = { tool_call_id: call.id, role: 'tool' as const, content: JSON.stringify(resultContent) };
          convo.push(toolMsg);
          allToolResults.push(toolMsg);
        }

        // Continue loop to let GPT act on tool outputs
        continue;
      }

      // No tool_calls → final answer
      lastAssistantMsg = assistant;
      break;
    }

    res.json({ message: lastAssistantMsg, toolCalls: allToolCalls, toolResults: allToolResults });
  } catch (err) {
    console.error('Chat error:', err as Error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// --------------------------------------------------
// Disconnect endpoint
// --------------------------------------------------
app.post('/api/mcp/disconnect', async (req, res) => {
  try {
    const { sessionId, serverIds } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const ids = Array.isArray(serverIds)
      ? serverIds
      : Array.from(activeMCPConnections.keys()).filter((k) => k.startsWith(sessionId)).map((k) => k.split('-')[1]);

    const disconnected: string[] = [];
    for (const id of ids) {
      const key = `${sessionId}-${id}`;
      const client = activeMCPConnections.get(key);
      if (client) {
        await client.close();
        activeMCPConnections.delete(key);
        disconnected.push(id);
      }
    }

    res.json({ disconnected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

//---------------------------------------------------
// Start server
//---------------------------------------------------
app.listen(PORT, () => {
  console.log(`MCP Chat Backend running on port ${PORT}`);
});
