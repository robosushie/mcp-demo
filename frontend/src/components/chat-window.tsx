"use client";
import { useChat } from "@ai-sdk/react";
import { ChatInput, ChatMessages, ChatSection } from "@llamaindex/chat-ui";
import { useEffect, useState } from "react";
import { McpServer } from "@/types/mcp-server";
import { SearchCodeIcon, SendIcon } from "lucide-react";
import { NEXT_PUBLIC_API_URL } from "@/config/env";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Chat, ChatMessage } from "@/types/chat";

interface Props {
  serverId: string | null;
  mcpServers: McpServer[];
  activeChat: string | null;
  currentChat: Chat | null;
  setCurrentChat: (chat: Chat | null) => void;
  setServerId: (serverId: string | null) => void;
  setActiveChat: (chatId: string | null) => void;
}

export default function ChatWindow({ serverId, mcpServers, activeChat, currentChat, setCurrentChat, setServerId, setActiveChat   }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedServer, setConnectedServer] = useState<string | null>(null);

  // Update messages when currentChat changes
  useEffect(() => {
    setMessages(currentChat?.history || []);
    setConnectedServer(currentChat?.mcpId || null);
  }, [currentChat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connectedServer || !activeChat) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      meta: {},
      iterations: []
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: connectedServer,
          message: input,
          chatId: activeChat
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.content,
        meta: data.meta,
        iterations: data.iterations
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update current chat with new messages
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          history: [...currentChat.history, userMessage, assistantMessage]
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "Sorry, there was an error processing your request.",
        meta: {},
        iterations: []
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Update current chat with error message
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          history: [...currentChat.history, userMessage, errorMessage]
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!activeChat) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: `Searching for servers related to: ${query}`,
      meta: {},
      iterations: []
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setInput('');

    try {
      const response = await fetch(
        `${NEXT_PUBLIC_API_URL}/servers/recommend?q=${encodeURIComponent(query)}&chatId=${activeChat}`,
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error("Failed to get server recommendations");
      }

      const servers = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `Found ${servers.length} recommended servers:\n\n${servers.map((server: any) => 
          `- **${server.id}**: ${server.description || 'No description available'}`
        ).join('\n')}`,
        meta: {},
        iterations: []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update current chat with new messages
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          history: [...currentChat.history, userMessage, assistantMessage]
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "Sorry, there was an error getting server recommendations.",
        meta: {},
        iterations: []
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Update current chat with error message
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          history: [...currentChat.history, userMessage, errorMessage]
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (serverId: string) => {
    // if (!activeChat) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: serverId, chatId: activeChat || '1' }),
      });
      const data = await response.json();
      console.log('Connection response:', data);
      setActiveChat(data.id);
      if (!response.ok) {
        
        throw new Error("Failed to connect to server");
      }

      setConnectedServer(serverId);
      setServerId(serverId);
      // setMessages([]); // Clear messages on new connection
      
      // Update current chat's MCP ID
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          mcpId: serverId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedServer || !activeChat) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectedServer, chatId: activeChat }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect from server");
      }

      setConnectedServer(null);
      // setMessages([]); // Clear messages on disconnect
      
      // Update current chat's MCP ID
      if (currentChat) {
        setCurrentChat({
          ...currentChat,
          mcpId: null,
          // history: []
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!serverId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a server to start chatting.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full w-full bg-neutral-200 p-4 overflow-y-scroll">
      <div className="flex flex-col gap-2 bg-neutral-50 rounded-2xl shadow-inner flex-1">
        {/* Message list */}
        <div className="flex-1 space-y-6 p-6 overflow-y-auto">
          {(messages || []).map((message, index) => (
            <div
              key={index}
              className={`flex w-full ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 break-words ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'user' ? (
                  message.content
                ) : (
                  <div className="relative overflow-x-auto max-w-2/3">
                    <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ maxWidth: '100%', overflowX: 'auto', breakWords: true }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      a: ({ node, ...props }) => (
                        <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul {...props} className="list-disc pl-4 my-2" />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol {...props} className="list-decimal pl-4 my-2" />
                      ),
                      li: ({ node, ...props }) => (
                        <li {...props} className="my-1" />
                      ),
                      p: ({ node, ...props }) => (
                        <p {...props} className="my-2" />
                      ),
                      h1: ({ node, ...props }) => (
                        <h1 {...props} className="text-2xl font-bold my-4" />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 {...props} className="text-xl font-bold my-3" />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 {...props} className="text-lg font-bold my-2" />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote {...props} className="border-l-4 border-gray-300 pl-4 my-2 italic" />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  </div>
                )}
                {message.meta && Object.keys(message.meta).length > 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    {message.meta.createdAt && (
                      <div>Created: {new Date(message.meta.createdAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <form onSubmit={handleSubmit} className="relative bg-white/60 backdrop-blur p-4 rounded-b-2xl">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 resize-none bg-gray-100 rounded-xl p-3"
              placeholder="Ask anything…"
              rows={1}
            />
            
            <div className="flex flex-col gap-1">
              <button 
                type="button"
                onClick={() => handleSearch(input)}
                className="relative h-10 w-10 grid place-content-center rounded-xl bg-gray-500 text-white cursor-pointer border-[1px] border-gray-500 hover:bg-gray-800"
              >
                <SearchCodeIcon className="h-5 w-5" />
              </button>
              
              <button 
                type="submit"
                disabled={!connectedServer || !input.trim() || isLoading}
                className="relative h-10 w-10 grid place-content-center rounded-xl bg-gray-500 text-white cursor-pointer border-[1px] border-gray-500 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="w-2/3 flex gap-3 flex-wrap">
        {mcpServers.map((server) => (
          connectedServer === server.id ? (
            <div 
              key={server.id}
              className="flex items-center justify-center gap-2 border-[1px] border-gray-600 w-32 text-sm rounded-full p-1 text-center cursor-pointer text-gray-900 bg-white hover:bg-white hover:text-gray-900"
              title={server.description}
              onClick={handleDisconnect}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full"/>{server.id}
            </div>
          ) : (
            <div 
              key={server.id}
              className="flex items-center justify-center gap-2 border-[1px] border-gray-600 w-32 text-sm rounded-full p-1 text-center cursor-pointer bg-gray-900 text-white hover:bg-white hover:text-gray-900"
              title={server.description}
              onClick={() => handleConnect(server.id)}
            >
              <div className="w-2 h-2 bg-gray-200 rounded-full"/>{server.id}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
