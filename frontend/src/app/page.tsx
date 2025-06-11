'use client';
import { useEffect, useState } from 'react';
import ChatWindow from '@/components/chat-window';
import Chats from '@/components/chats';
import { Chat } from '@/types/chat';
import { McpServer } from '@/types/mcp-server';
import { NEXT_PUBLIC_API_URL } from '@/config/env';

export default function HomePage() {
  const [serverId, setServerId] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await fetch(NEXT_PUBLIC_API_URL + '/servers');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('Fetched servers:', data);
        setMcpServers(data);
        if (data.length > 0) {
          setServerId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
      }
    };

    fetchServers();
  }, []);

  // Fetch chat details when activeChat changes
  useEffect(() => {
    if (activeChat) {
      fetch(`${NEXT_PUBLIC_API_URL}/chats/${activeChat}`)
        .then(res => res.json())
        .then(chat => setCurrentChat(chat))
        .catch(err => console.error("Error fetching chat:", err));
    } else {
      setCurrentChat(null);
    }
  }, [activeChat]);
  
  return (
    <div className="flex h-full w-full">
      <Chats 
        chats={chats}   
        setChats={setChats}     
        activeChat={activeChat} 
        setActiveChat={setActiveChat} 
        setCurrentChat={setCurrentChat}
        serverId={serverId}
      />
      <main className="flex flex-1 flex-col">
        <ChatWindow 
          serverId={serverId} 
          mcpServers={mcpServers} 
          activeChat={activeChat}
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          setServerId={setServerId}
          setActiveChat={setActiveChat}
          />
      </main>
    </div>
  );
}