import {
    Client,
} from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPTool } from "beeai-framework/tools/mcp";
import { ReActAgent } from "beeai-framework/agents/react/agent";
import { UnconstrainedMemory } from "beeai-framework/memory/unconstrainedMemory";
import { OpenAIChatModel } from "beeai-framework/adapters/openai/backend/chat";
import { OpenAI } from "openai";

import dotenv from "dotenv";
// Configure environment variables
dotenv.config();

// ---------- Types ----------
export interface MCPServer {
    id: string;
    name: string;
    description: string;
    category: string;
    command: string;
    args: string[];
    capabilities: string[];
    tags: string[];
}

interface ActiveConnection {
    client: Client;
    agent: ReActAgent;
}

// ---------- Static catalogue ----------
// In real life you might fetch https://glama.ai/mcp/servers but here we keep it local.
// Each record must launch to a server exposing MCP tool capability.
export const CATALOGUE: MCPServer[] = [
    {
        id: "filesystem",
        name: "Filesystem MCP Server",
        description: 'Provides comprehensive filesystem operations - read, write, list files, manage directories. Essential for any coding or file management tasks.',
        category: 'Developer Tools',
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/pi2/Code/"],
        capabilities: ['file_read', 'file_write', 'file_operations', 'directory_operations'],
        tags: ['files', 'filesystem', 'coding', 'development', 'file-management'],
      
    },
    {
        id: "brave-search",
        name: "Brave Search MCP Server",
        description: 'Search the web using Brave Search API. Get real-time information, research topics, find documentation, and access current events.',
        category: 'Internet & Research',
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        capabilities: ['web_search', 'real_time_info', 'research'],
        tags: ['search', 'internet', 'research', 'web', 'brave', 'real-time'],
    },
    {
        id: "puppeteer",
        name: "Puppeteer Web Scrape MCP Server",
        description: 'Browser automation and web scraping - take screenshots, extract data, fill forms, test web apps. Control Chrome/Chromium programmatically.',
        category: 'Web Automation',
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
        capabilities: ['web_scraping', 'browser_automation', 'screenshot', 'form_filling', 'web_testing'],
        tags: ['puppeteer', 'web', 'scraping', 'automation', 'browser', 'testing'],
    },
    {
        id: "postgres",
        name: "PostgreSQL MCP Server",
        description: 'Direct PostgreSQL database access - run queries, manage schemas, analyze data. Essential for database operations and data analysis.',
        category: 'Database & Data',
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres"],
        capabilities: ['sql_queries', 'schema_management', 'data_analysis', 'database_operations'],
        tags: ['database', 'postgres', 'sql', 'data', 'analytics', 'postgresql'],
    },
    {
        id: "github",
        name: "GitHub MCP Server",
        description: 'Full GitHub integration - manage repositories, issues, pull requests, code search, and more. Perfect for development workflows.',
        category: 'Developer Tools',
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        capabilities: ['repository_management', 'issue_tracking', 'pull_requests', 'code_search'],
        tags: ['github', 'git', 'coding', 'version-control', 'collaboration', 'development'],
    },
];

// ---------- OpenAI LLM instance ----------
const openaiLLM = new OpenAIChatModel("gpt-4o");
openaiLLM.config({ parameters: { temperature: 0.2 } });

// ---------- In‑memory cache ----------
const ACTIVE: Record<string, ActiveConnection> = {};

// ---------- Public helpers ----------
export function getAllServers() {
    return CATALOGUE;
}

export async function getRecommendedServers(query: string) {
    if (!query.trim()) return CATALOGUE;

    try {
        // Create a prompt for AI to recommend servers
        const serverDescriptions = CATALOGUE.map(s => 
            `${s.id}: ${s.name} - ${s.description} (Category: ${s.category}, Capabilities: ${s.capabilities.join(', ')}, Tags: ${s.tags.join(', ')})`
        ).join('\n');

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are an MCP server recommendation system. Based on the user's query and the task they want to achieve, recommend relevant MCP servers from the list below.

                    IMPORTANT: You must return a JSON object with exactly one key called "servers" containing an array of server IDs. Maximum 3 servers.
                    Example response format: { "servers": ["server-id-1", "server-id-2"] }
                    DO NOT include any markdown formatting or backticks in your response.

                    Available MCP Servers:
                    ${serverDescriptions}`
                },
                {
                    role: 'user',
                    content: query
                }
            ],
            temperature: 0.3,
        });

        const rawResponse = completion.choices[0].message.content || '';
        console.log('AI Response:', rawResponse);
        
        // Clean the response by removing markdown formatting if present
        const cleanResponse = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
        const response = JSON.parse(cleanResponse);
        console.log('Parsed response:', response);
        
        if (!response.servers || !Array.isArray(response.servers)) {
            console.log('Invalid AI response format, falling back to keyword search');
            return fallbackToKeywordSearch(query);
        }

        // Get the full server details for the recommended IDs
        return CATALOGUE.filter(server => response.servers.includes(server.id));
    } catch (error) {
        console.error('Error getting AI recommendations:', error);
        return fallbackToKeywordSearch(query);
    }
}

// Fallback to keyword-based search
function fallbackToKeywordSearch(query: string) {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    
    return CATALOGUE.filter((srv) =>
        terms.some((term) => 
            srv.tags.some((tag) => tag.includes(term)) ||
            srv.capabilities.some((cap) => cap.includes(term)) ||
            srv.description.toLowerCase().includes(term)
        )
    ).slice(0, 3); // Limit to top 3 matches
}

export async function connectToServer(id: string) {
    if (ACTIVE[id]) return;
    const spec = CATALOGUE.find((s) => s.id === id);
    if (!spec) throw new Error(`Unknown server '${id}'`);

    // Set environment variables for the server
    if (spec.id === 'brave-search' && !process.env.BRAVE_API_KEY) {
        throw new Error('BRAVE_API_KEY environment variable is required for Brave Search server');
    }

    // 1. Spin up MCP client -> transport spawns the server process via stdio
    const client = new Client({ name: `${id}-client`, version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: spec.command,
        args: spec.args,
        env: Object.fromEntries(
            Object.entries(process.env).filter(([_, value]) => value !== undefined)
        ) as Record<string, string>
    });
    await client.connect(transport);

    // 2. Discover all tools exposed by the server via MCPTool factory
    const tools = await MCPTool.fromClient(client);

    // 3. Create a lightweight ReAct agent for this connection
    const agent = new ReActAgent({
        llm: openaiLLM,
        memory: new UnconstrainedMemory(),
        tools,
    });

    ACTIVE[id] = { client, agent };
}

export async function disconnectFromServer(id: string) {
    const active = ACTIVE[id];
    if (!active) return;
    await active.client.close();
    delete ACTIVE[id];
}

export async function chatWithAgent(id: string, message: string) {
    const active = ACTIVE[id];
    if (!active) throw new Error(`Server '${id}' is not connected`);

    const result = await active.agent.run({ prompt: message });
    
    // Process the MCP response structure
    if (result && typeof result === 'object') {
        // Handle the standard MCP response format
        if ('result' in result) {
            const mcpResult = result.result;
            
            // Extract content from the MCP response
            if (mcpResult.content && Array.isArray(mcpResult.content)) {
                // Combine all text content
                const textContent = mcpResult.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('\n');

                // Use OpenAI to format the response
                try {
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                    const completion = await openai.chat.completions.create({
                        model: "gpt-4",
                        messages: [
                            {
                                role: "system",
                                content: `You are a response formatter. Your task is to:
1. Take the raw MCP server response and format it into a clear, well-structured markdown message
2. Preserve all important information while making it more readable
3. If there are any code snippets, format them properly with markdown
4. If there are any links, make them clickable
5. If there are any lists or structured data, format them appropriately
6. Return ONLY the formatted text, no additional explanations or metadata`
                            },
                            {
                                role: "user",
                                content: `Please format this MCP server response into a clear, well-structured message:\n\n${textContent}`
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 1000
                    });

                    const formattedContent = completion.choices[0]?.message?.content || textContent;
                
                    return {
                        role: 'assistant',
                        content: formattedContent,
                        meta: mcpResult.meta || {},
                        iterations: result.iterations || [],
                        raw: textContent // Keep the raw content for reference
                    };
                } catch (error) {
                    console.error('Error formatting response with OpenAI:', error);
                    // Fallback to unformatted content if formatting fails
                    return {
                        role: 'assistant',
                        content: textContent,
                        meta: mcpResult.meta || {},
                        iterations: result.iterations || []
                    };
                }
            }
        }
        console.log(result);
        // If it's a different object structure, stringify it
        return {
            role: 'assistant',
            content: JSON.stringify(result, null, 2),
            meta: {},
            iterations: []
        };
    }
    
    // Handle string or other primitive responses
    return {
        role: 'assistant',
        content: String(result) || "(no answer)",
        meta: {},
        iterations: []
    };
}