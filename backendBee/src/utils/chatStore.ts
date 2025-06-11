import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    meta?: any;
    iterations?: any;
}

interface Chat {
    id: string;
    title: string;
    mcpId: string | null;
    history: ChatMessage[];
}

// In-memory chat store
const chatStore: Chat[] = [];

// Generate a new chat ID and title
function generateChatId(): string {
    return uuidv4();
}

function generateChatTitle(): string {
    return `Chat ${chatStore.length + 1}`;
}

// Add a new chat
export function createChat(mcpId: string | null = null): Chat {
    const chat: Chat = {
        id: generateChatId(),
        title: generateChatTitle(),
        mcpId,
        history: []
    };
    chatStore.push(chat);
    return chat;
}

// Get chat by ID
export function getChat(id: string): Chat | undefined {
    return chatStore.find(chat => chat.id === id);
}

// Get list of all chats (id and title only)
export function getChatsList(): Array<{ id: string; title: string; mcpId: string | null }> {
    return chatStore.map(chat => ({
        id: chat.id,
        title: chat.title,
        mcpId: chat.mcpId
    }));
}

// Add message to chat
export function addMessageToChat(chatId: string, message: ChatMessage): void {
    const chat = getChat(chatId);
    if (chat) {
        chat.history.push(message);
    }
}

// Get or create chat
export function getOrCreateChat(chatId?: string, mcpId: string | null = null): Chat {
    if (chatId) {
        const existingChat = getChat(chatId);
        if (existingChat) {
            // Update MCP ID if provided
            if (mcpId !== null) {
                existingChat.mcpId = mcpId;
            }
            return existingChat;
        }
    }
    return createChat(mcpId);
}
