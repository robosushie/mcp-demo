// mcp-servers-config.ts
// Curated list of high-quality MCP servers for different use cases

import dotenv from 'dotenv';
dotenv.config();

console.log(process.env.BRAVE_API_KEY);

export interface MCPServerConfig {
    id: string;
    name: string;
    description: string;
    category: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    capabilities: string[];
    tags: string[];
    tools: Array<{
      name: string;
      description: string;
      inputSchema?: any;
    }>;
    repository?: string;
    documentation?: string;
  }
  
  export const CURATED_MCP_SERVERS: MCPServerConfig[] = [
    {
      id: 'filesystem',
      name: 'Filesystem MCP Server',
      description: 'Provides comprehensive filesystem operations - read, write, search files, manage directories. Essential for any coding or file management tasks.',
      category: 'Developer Tools',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/pi2/Code/lumif.ai/backend'],
      capabilities: ['file_read', 'file_write', 'file_search', 'directory_operations'],
      tags: ['files', 'filesystem', 'coding', 'development', 'file-management'],
      tools: [
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the file to read' }
            },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the file to write' },
              content: { type: 'string', description: 'Content to write to the file' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'list_directory',
          description: 'List contents of a directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the directory' }
            },
            required: ['path']
          }
        },
        {
          name: 'create_directory',
          description: 'Create a new directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path for the new directory' }
            },
            required: ['path']
          }
        },
        {
          name: 'search_files',
          description: 'Search for files by name or content',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory to search in' },
              pattern: { type: 'string', description: 'Search pattern' }
            },
            required: ['path', 'pattern']
          }
        }
      ],
      repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
      documentation: 'https://modelcontextprotocol.io/docs/concepts/servers#filesystem'
    },
    
    {
      id: 'brave-search',
      name: 'Brave Search MCP Server',
      description: 'Search the web using Brave Search API. Get real-time information, research topics, find documentation, and access current events.',
      category: 'Internet & Research',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { 
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || ''
      },
      capabilities: ['web_search', 'real_time_info', 'research'],
      tags: ['search', 'internet', 'research', 'web', 'brave', 'real-time'],
      tools: [
        {
          name: 'brave_web_search',
          description: 'Search the web using Brave Search',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              count: { type: 'number', description: 'Number of results to return', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'brave_local_search',  // Add this tool too
          description: 'Search for local businesses and places',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      ],
      repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
      documentation: 'https://modelcontextprotocol.io/docs/concepts/servers#brave-search'
    },
    
    {
      id: 'github',
      name: 'GitHub MCP Server',
      description: 'Full GitHub integration - manage repositories, issues, pull requests, code search, and more. Perfect for development workflows.',
      category: 'Developer Tools',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { 
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
      },
      capabilities: ['repository_management', 'issue_tracking', 'pull_requests', 'code_search'],
      tags: ['github', 'git', 'coding', 'version-control', 'collaboration', 'development'],
      tools: [
        {
          name: 'create_or_update_file',
          description: 'Create or update a file in a GitHub repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'Repository owner' },
              repo: { type: 'string', description: 'Repository name' },
              path: { type: 'string', description: 'File path in the repository' },
              content: { type: 'string', description: 'File content' },
              message: { type: 'string', description: 'Commit message' },
              branch: { type: 'string', description: 'Branch name', default: 'main' }
            },
            required: ['owner', 'repo', 'path', 'content', 'message']
          }
        },
        {
          name: 'search_repositories',
          description: 'Search for GitHub repositories',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum results', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'create_issue',
          description: 'Create a new issue in a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'Repository owner' },
              repo: { type: 'string', description: 'Repository name' },
              title: { type: 'string', description: 'Issue title' },
              body: { type: 'string', description: 'Issue body' }
            },
            required: ['owner', 'repo', 'title']
          }
        },
        {
          name: 'create_pull_request',
          description: 'Create a new pull request',
          inputSchema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'Repository owner' },
              repo: { type: 'string', description: 'Repository name' },
              title: { type: 'string', description: 'PR title' },
              body: { type: 'string', description: 'PR description' },
              head: { type: 'string', description: 'Source branch' },
              base: { type: 'string', description: 'Target branch' }
            },
            required: ['owner', 'repo', 'title', 'head', 'base']
          }
        }
      ],
      repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
      documentation: 'https://modelcontextprotocol.io/docs/concepts/servers#github'
    },
    {
      id: 'postgres',
      name: 'PostgreSQL MCP Server',
      description: 'Direct PostgreSQL database access - run queries, manage schemas, analyze data. Essential for database operations and data analysis.',
      category: 'Database & Data',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { 
        POSTGRES_CONNECTION_STRING: process.env.POSTGRES_CONNECTION_STRING || 'postgresql://localhost/mydb'
      },
      capabilities: ['sql_queries', 'schema_management', 'data_analysis', 'database_operations'],
      tags: ['database', 'postgres', 'sql', 'data', 'analytics', 'postgresql'],
      tools: [
        {
          name: 'query',
          description: 'Execute a PostgreSQL query',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'SQL query to execute' }
            },
            required: ['sql']
          }
        },
        {
          name: 'list_tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'describe_table',
          description: 'Get schema information for a table',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'Name of the table' }
            },
            required: ['table_name']
          }
        }
      ],
      repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
      documentation: 'https://modelcontextprotocol.io/docs/concepts/servers#postgres'
    },
    
    {
      id: 'puppeteer',
      name: 'Puppeteer Web Automation MCP Server',
      description: 'Browser automation and web scraping - take screenshots, extract data, fill forms, test web apps. Control Chrome/Chromium programmatically.',
      category: 'Web Automation',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      env: { 
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium-browser',
        PUPPETEER_NO_SANDBOX: '1'
      },
      capabilities: ['web_scraping', 'browser_automation', 'screenshot', 'form_filling', 'web_testing'],
      tags: ['puppeteer', 'web', 'scraping', 'automation', 'browser', 'testing'],
      tools: [
        {
          name: 'navigate',
          description: 'Navigate to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to navigate to' }
            },
            required: ['url']
          }
        },
        {
          name: 'screenshot',
          description: 'Take a screenshot of the current page',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to save the screenshot' },
              fullPage: { type: 'boolean', description: 'Capture full page', default: false }
            },
            required: ['path']
          }
        },
        {
          name: 'extract_content',
          description: 'Extract content from the page using CSS selectors',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector' },
              attribute: { type: 'string', description: 'Attribute to extract (optional)' }
            },
            required: ['selector']
          }
        },
        {
          name: 'click',
          description: 'Click an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of element to click' }
            },
            required: ['selector']
          }
        },
        {
          name: 'fill_form',
          description: 'Fill a form field with text',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the input field' },
              value: { type: 'string', description: 'Value to fill' }
            },
            required: ['selector', 'value']
          }
        }
      ],
      repository: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
      documentation: 'https://modelcontextprotocol.io/docs/concepts/servers#puppeteer'
    }
  ];
  
  // Helper function to find servers by capability
  export function findServersByCapability(capability: string): MCPServerConfig[] {
    return CURATED_MCP_SERVERS.filter(server => 
      server.capabilities.some(cap => cap.toLowerCase().includes(capability.toLowerCase())) ||
      server.tags.some(tag => tag.toLowerCase().includes(capability.toLowerCase()))
    );
  }
  
  // Helper function to find servers by category
  export function findServersByCategory(category: string): MCPServerConfig[] {
    return CURATED_MCP_SERVERS.filter(server => 
      server.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  
  // Get server by ID
  export function getServerById(id: string): MCPServerConfig | undefined {
    return CURATED_MCP_SERVERS.find(server => server.id === id);
  }