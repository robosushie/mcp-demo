export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: Record<string, any>;
  iterations?: any[];
}

export interface Chat {
  id: string;
  title: string;
  mcpId: string | null;
  history: ChatMessage[];
} 