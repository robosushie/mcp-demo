// server.ts – MCP Chat backend (fully revised)
// --------------------------------------------------
// 1. Environment & third‑party libs
// --------------------------------------------------
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI, { ChatCompletionTool } from 'openai';
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
// 2. Constants & singletons
// --------------------------------------------------
const PORT = process.env.PORT || 3001;
const app  = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const activeMCPConnections = new Map<string, Client>();

// --------------------------------------------------
// 3. Helper functions
// --------------------------------------------------
/**
 * Extract the server‑id part from the composite key "${sessionId}-${serverId}".
 */
function extractServerId(key: string, sessionId: string): string {
  const prefix = `${sessionId}-`;
  if (!key.startsWith(prefix)) {
    throw new Error(`Key \"${key}\" does not start with \"${prefix}\"`);
  }
  return key.slice(prefix.length);
}

/**
 * Spin up (or attach to) an MCP server process via stdio transport.
 */
async function connectToMCPServer(serverId: string): Promise<Client> {
  const server = await fetchMCPServerDetails(serverId);
  if (!server) throw new Error(`MCP server \"${serverId}\" not found`);

  const cfg = normalizeServerConfig(server);
  if (!cfg.command || !cfg.args) {
    throw new Error(`MCP server \"${serverId}\" missing command configuration`);
  }

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
// 4. REST endpoints
// --------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', activeConnections: activeMCPConnections.size });
});

app.get('/api/mcp/servers', async (req: Request, res: Response) => {
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

app.post('/api/mcp/recommend', async (req: Request, res: Response) => {
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

    res.json({
      recommendations: recs.filter(Boolean),
      query,
      source: useAI ? 'ai' : 'search',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to recommend MCP servers' });
  }
});

app.post('/api/mcp/connect', async (req: Request, res: Response) => {
  try {
    const { sessionId, serverIds } = req.body;
    if (!sessionId || !Array.isArray(serverIds)) {
      return res.status(400).json({ error: 'sessionId and serverIds array are required' });
    }

    const connected: Array<{ id: string; status: string; error?: string }> = [];
    for (const id of serverIds) {
      const key = `${sessionId}-${id}`;
      if (!activeMCPConnections.has(key)) {
        try {
          const client = await connectToMCPServer(id);
          activeMCPConnections.set(key, client);
          connected.push({ id, status: 'connected' });
        } catch (e: any) {
          console.error(e);
          connected.push({ id, status: 'failed', error: e.message });
        }
      } else {
        connected.push({ id, status: 'already connected' });
      }
    }

    res.json({ connectedServers: connected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect to MCP servers' });
  }
});

app.post('/api/mcp/tools', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const tools: Array<{ serverId: string; name: string; description?: string; inputSchema?: any }> = [];
    for (const [key, client] of activeMCPConnections) {
      if (!key.startsWith(sessionId)) continue;

      const serverId = extractServerId(key, sessionId);
      const { tools: serverTools } = await client.listTools();
      serverTools.forEach((t) => {
        tools.push({
          serverId,
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema || {},
        });
      });
    }

    res.json({ tools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { sessionId, messages, useMCP = true } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'sessionId and messages are required' });
    }

    // ------------------------------------------------------------------
    // 1) Build OpenAI "tools" array from connected MCP servers
    // ------------------------------------------------------------------
    const toolsList: ChatCompletionTool[] = [];

    if (useMCP) {
      for (const [key, client] of activeMCPConnections) {
        if (!key.startsWith(`${sessionId}-`)) continue;

        const serverId = extractServerId(key, sessionId);
        const { tools: serverTools } = await client.listTools();

        for (const t of serverTools) {
          toolsList.push({
            type: 'function',
            function: {
              name: `${serverId}_${t.name}`,
              description: t.description || '',
              parameters:
                t.inputSchema && Object.keys(t.inputSchema).length
                  ? t.inputSchema
                  : { type: 'object', properties: {} },
            },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // 2) Ask GPT which tool (if any) it wants to call
    // ------------------------------------------------------------------
    const first = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      tools: toolsList,
      tool_choice: 'auto',
    });

    const assistantMsg = first.choices[0].message!;

    // ------------------------------------------------------------------
    // 3) If a tool call is requested, fulfil it
    // ------------------------------------------------------------------
    if (assistantMsg.tool_calls?.length) {
      const toolCalls = assistantMsg.tool_calls;
      const toolResults: Array<{ tool_call_id: string; role: 'tool'; content: string }> = [];

      for (const call of toolCalls) {
        if (!call.function) continue; // defensive

        const tool_call_id = call.id;
        const fullName     = call.function.name;
        const rawArgs      = call.function.arguments;
        const args         = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};

        const [serverId, ...fnParts] = fullName.split('_');
        const fnName = fnParts.join('_');
        const clientKey = `${sessionId}-${serverId}`;
        const client    = activeMCPConnections.get(clientKey);

        let resultContent: any;
        if (client) {
          try {
            const result = await client.callTool({ name: fnName, arguments: args });
            resultContent = result.content;
          } catch (err: any) {
            resultContent = { error: err.message };
          }
        } else {
          resultContent = { error: `MCP server \"${serverId}\" not connected` };
        }

        toolResults.push({
          tool_call_id,
          role: 'tool',
          content: JSON.stringify(resultContent),
        });
      }

      // ----------------------------------------------------------------
      // 4) Second pass – give GPT the tool outputs
      // ----------------------------------------------------------------
      const followup = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...messages,
          { role: 'assistant', content: null, tool_calls: toolCalls },
          ...toolResults,
        ],
      });

      return res.json({
        message: followup.choices[0].message,
        toolCalls,
        toolResults,
      });
    }

    // ------------------------------------------------------------------
    // 5) Otherwise return GPT's direct answer
    // ------------------------------------------------------------------
    res.json({ message: assistantMsg });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

app.post('/api/mcp/disconnect', async (req: Request, res: Response) => {
  try {
    const { sessionId, serverIds } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const toDisconnect = Array.isArray(serverIds)
      ? serverIds
      : Array.from(activeMCPConnections.keys())
          .filter((k) => k.startsWith(sessionId))
          .map((k) => k.split('-')[1]);

    const disconnected: string[] = [];
    for (const id of toDisconnect) {
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

// --------------------------------------------------
// 5. Start server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`MCP Chat Backend running on port ${PORT}`);
});

// --------------------------------------------------
// 6. (Optional) quick self‑test – uncomment to verify
// --------------------------------------------------

// (async () => {
//   try {
//     const testClient = await connectToMCPServer('puppeteer');
//     const search     = await testClient.callTool({
//       name: 'puppeteer_extract_content',
//         arguments: { url: 'https://modelcontextprotocol.io/examples' },
//     });
//     console.log('[self‑test] puppeteer result:', search.content[0]?.text?.slice(0, 140) || '');
//   } catch (err) {
//     console.error('[self‑test] Error:', err);
//   }
// })();

