'use client';
import { useEffect, useState } from 'react';
import { Chat } from '@/types/chat';
import clsx from 'classnames';
import { NEXT_PUBLIC_API_URL } from '@/config/env';

interface Props {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  setCurrentChat: (chat: Chat | null) => void;
  serverId: string | null;
}

export default function Chats({ chats, setChats, activeChat, setActiveChat, setCurrentChat, serverId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/chats`);
      if (!response.ok) {
        throw new Error("Failed to fetch chats");
      }
      const data = await response.json();
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [setChats, serverId]);

  const handleChatSelect = async (chatId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/chats/${chatId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chat details");
      }
      const chat = await response.json();
      setActiveChat(chatId);
      setCurrentChat(chat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const emptyChat: Chat = {
      id: "1",
      title: "New Chat",
      mcpId: null,
      history: []
    };
    setActiveChat("1");
    setCurrentChat(emptyChat);
  };

  return (
    <div className="w-70 shrink-0 border-r flex flex-col gap-4 border-gray-300 p-4">
      <div className="flex gap-2 w-full py-2 px-4 text-lg font-semibold text-center rounded-md border-2 border-gray-300 shadow-md cursor-pointer">
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
                <path d="M410-120v-238L204-239l-70-121 206-120-206-119 70-121 206 119v-239h140v239l206-119 70 121-206 119 206 120-70 121-206-119v238H410Z"/>
            </svg>
        </div>
        <div>MCP Agents</div>
      </div>

      <div 
        onClick={handleNewChat}
        className="flex gap-2 w-full py-2 px-4 text-lg font-semibold text-center rounded-md border-2 border-gray-300 shadow-md cursor-pointer hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ opacity: serverId ? 1 : 0.5 }}
      >
        <div>New Chat</div>
      </div>
     
      <div className="flex flex-col w-full p-2 text-sm gap-2">
        <div className='text-lg'>Chat History</div>
        <hr className="border-gray-300" />
        
        {isLoading ? (
          <div className="text-gray-500">Loading chats...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : chats.length === 0 ? (
          <div className="text-gray-500">No chats yet</div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={clsx(
                'p-2 rounded-md cursor-pointer hover:bg-gray-100',
                activeChat === chat.id && 'bg-gray-100 font-medium'
              )}
            >
              <div className="font-medium">{chat.title}</div>
            {chat.mcpId && (
              <div className="text-sm text-gray-500">
                Connected to: {chat.mcpId}
              </div>
            )}
          </div>
           
          ))
        )}
      </div>
    </div>
  );
}