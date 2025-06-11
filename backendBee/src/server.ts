import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from 'cors';
// Configure environment variables
dotenv.config();

import {
  getAllServers,
  getRecommendedServers,
  connectToServer,
  disconnectFromServer,
  chatWithAgent,
} from "./utils/mcpService.js";

import {
  getOrCreateChat,
  getChat,
  getChatsList,
  addMessageToChat,
} from "./utils/chatStore.js";

// Debug: Log environment variables
console.log('Environment variables loaded:');
console.log('BRAVE_API_KEY:', process.env.BRAVE_API_KEY);
console.log('PORT:', process.env.PORT);

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://192.168.1.12:3000', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 1️⃣  List every known MCP server
app.get("/servers", (_: Request, res: Response) => {
  res.json(getAllServers());
});

// 2️⃣  Recommend servers based on simple tag + keyword matching
app.get("/servers/recommend", async (req: Request, res: Response) => {
  const { q, chatId } = req.query;
  try {
    const servers = await getRecommendedServers(typeof q === "string" ? q : "");
    
    // Store the recommendation in chat history if chatId is provided
    if (chatId && typeof chatId === 'string') {
      const chat = getOrCreateChat(chatId);
      addMessageToChat(chat.id, {
        role: 'user',
        content: `Searching for servers related to: ${q}`
      });
      addMessageToChat(chat.id, {
        role: 'assistant',
        content: `Found ${servers.length} recommended servers:\n\n${servers.map(server => 
          `- **${server.id}**: ${server.description || 'No description available'}`
        ).join('\n')}`,
        meta: {},
        iterations: []
      });
    }
    
    res.json(servers);
  } catch (error) {
    console.error('Error getting server recommendations:', error);
    res.status(500).json({ error: 'Failed to get server recommendations' });
  }
});

// 3️⃣  Connect (spawns the server process & discovers its tools)
app.post("/connect", async (req: Request, res: Response) => {
  const { id, chatId } = req.body;
  let chat: Chat | null = null;
  try {
    await connectToServer(id);
    // Update chat's MCP ID if chatId is provided
    if (chatId) {
      chat = getOrCreateChat(chatId, id);
      console.log(chat)
    }
    res.json({ status: "connected", id: chat?.id || '1' });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "connect failed" });
  }
});

// 4️⃣  Disconnect and clean up
app.post("/disconnect", async (req: Request, res: Response) => {
  const { id, chatId } = req.body;
  await disconnectFromServer(id);
  // Clear chat's MCP ID if chatId is provided
  if (chatId) {
    const chat = getChat(chatId);
    if (chat) {
      chat.mcpId = null;
    }
  }
  res.json({ status: "disconnected", id });
});

// 5️⃣  Chat – send a user message, get assistant reply
app.post("/chat", async (req: Request, res: Response) => {
  const { id, message, chatId } = req.body as { id: string; message: string; chatId?: string };
  try {
    const response = await chatWithAgent(id, message);
    
    // Store the chat in history if chatId is provided
    if (chatId) {
      const chat = getOrCreateChat(chatId, id);
      addMessageToChat(chat.id, {
        role: 'user',
        content: message
      });
      addMessageToChat(chat.id, {
        role: 'assistant',
        content: response.content,
        meta: response.meta,
        iterations: response.iterations
      });
    }
    
    res.json(response);
  } catch (err: any) {
    const errorResponse = { 
      error: err.message ?? "chat failed",
      role: 'assistant' as const,
      content: "Sorry, there was an error processing your request.",
      meta: {},
      iterations: []
    };
    
    // Store error in chat history if chatId is provided
    if (chatId) {
      const chat = getOrCreateChat(chatId, id);
      addMessageToChat(chat.id, {
        role: 'user',
        content: message
      });
      addMessageToChat(chat.id, errorResponse);
    }
    
    res.status(500).json(errorResponse);
  }
});

// 6️⃣  Get list of all chats
app.get("/chats", (_: Request, res: Response) => {
  res.json(getChatsList());
});

// 7️⃣  Get specific chat by ID
app.get("/chats/:id", (req: Request, res: Response) => {
  const chat = getChat(req.params.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
});

// 8️⃣  Create new chat
app.post("/chats", (req: Request, res: Response) => {
  const { mcpId } = req.body as { mcpId?: string };
  const chat = getOrCreateChat(undefined, mcpId || null);
  res.json(chat);
});

const PORT = Number(process.env.PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  MCP service running on http://0.0.0.0:${PORT}`);
});