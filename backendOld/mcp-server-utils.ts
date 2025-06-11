// mcp-server-utils.ts
// Utility functions for managing MCP servers from curated list

import dotenv from 'dotenv';
dotenv.config();

import { CURATED_MCP_SERVERS, MCPServerConfig } from './mcp-server-config.js';

interface MCPServerSearchParams {
  query?: string;
  category?: string;
  limit?: number;
}

/**
 * Fetch MCP servers from curated list
 */
export async function fetchMCPServers(params?: MCPServerSearchParams): Promise<MCPServerConfig[]> {
  let servers = [...CURATED_MCP_SERVERS];
  
  // Filter by category if provided
  if (params?.category) {
    servers = servers.filter(s => 
      s.category.toLowerCase().includes(params.category!.toLowerCase())
    );
  }
  
  // Filter by query if provided
  if (params?.query) {
    const queryLower = params.query.toLowerCase();
    servers = servers.filter(s => {
      const searchText = `${s.name} ${s.description} ${s.tags?.join(' ') || ''} ${s.capabilities?.join(' ') || ''}`.toLowerCase();
      return searchText.includes(queryLower);
    });
  }
  
  // Apply limit if provided
  if (params?.limit) {
    servers = servers.slice(0, params.limit);
  }
  
  return servers;
}

/**
 * Get details of a specific MCP server by ID
 */
export async function fetchMCPServerDetails(serverId: string): Promise<MCPServerConfig | null> {
  const server = CURATED_MCP_SERVERS.find(s => s.id === serverId);
  return server || null;
}

/**
 * Search for MCP servers based on user intent using AI
 */
export async function recommendMCPServersWithAI(userQuery: string, openaiClient: any): Promise<string[]> {
  try {
    // First, fetch all available servers
    const allServers = await fetchMCPServers({ limit: 50 });
    
    // Create a prompt for AI to recommend servers
    const serverDescriptions = allServers.map(s => 
      `${s.id}: ${s.name} - ${s.description} (Category: ${s.category}, Tools: ${s.tools?.map(t => t.name).join(', ')})`
    ).join('\n');

    console.log('Available servers for recommendation:', serverDescriptions);

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an MCP server recommendation system. Based on the user's query and the task they want to achieve, recommend relevant MCP servers from the list below.

            IMPORTANT: You must return a JSON object with exactly one key called "servers" containing an array of server IDs. Maximum 3 servers.
            Example response format: { "servers": ["server-id-1", "server-id-2"] }

            Available MCP Servers:
            ${serverDescriptions}`
        },
        {
          role: 'user',
          content: userQuery
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    console.log('AI Response:', completion.choices[0].message.content);
    
    const response = JSON.parse(completion.choices[0].message.content || '{}');
    console.log('Parsed response:', response);
    
    if (!response.servers || !Array.isArray(response.servers)) {
      console.log('Invalid response format, falling back to keyword search');
      return recommendMCPServersByKeywords(userQuery);
    }
    
    return response.servers;
  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    // Fallback to keyword matching
    return recommendMCPServersByKeywords(userQuery);
  }
}

/**
 * Simple keyword-based MCP server recommendation
 */
export async function recommendMCPServersByKeywords(query: string): Promise<string[]> {
  const servers = await fetchMCPServers();
  const queryLower = query.toLowerCase();
  
  const scores = servers.map(server => {
    let score = 0;
    const searchText = `${server.name} ${server.description} ${server.tags?.join(' ') || ''} ${server.capabilities?.join(' ') || ''}`.toLowerCase();
    
    // Score based on keyword matches
    const keywords = queryLower.split(' ');
    keywords.forEach(keyword => {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    });
    
    // Bonus for category match
    if (queryLower.includes('code') && server.category === 'Developer Tools') score += 2;
    if (queryLower.includes('search') && server.category === 'Internet & Research') score += 2;
    if (queryLower.includes('data') && server.category === 'Data') score += 2;
    
    return { server, score };
  });
  
  // Sort by score and return top 3
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter(item => item.score > 0)
    .map(item => item.server.id);
}

/**
 * Convert server format to internal format if needed
 */
export function normalizeServerConfig(server: MCPServerConfig) {
  return server;
}