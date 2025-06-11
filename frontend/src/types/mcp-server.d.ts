export interface McpServer {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string;
  args: string[];
  capabilities: string[];
  tags: string[];
} 