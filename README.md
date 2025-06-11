# MCP Chat Application

A chat application that integrates with Model Context Protocol (MCP) servers to provide intelligent chat capabilities with various AI tools and services.

## Project Structure

The project consists of three main components:

### Frontend (`/frontend`)
- Built with Next.js and TypeScript
- Features a modern chat interface with real-time message updates
- Supports markdown rendering and code syntax highlighting
- Allows users to:
  - Connect to different MCP servers
  - Send messages and receive AI responses
  - View chat history
  - Search and connect to recommended servers

### BackendBee (`/backendBee`)
- The current active backend implementation
- Built with Express.js and TypeScript
- Provides RESTful API endpoints for:
  - Server management (list, connect, disconnect)
  - Chat functionality
  - Server recommendations
- Integrates with MCP servers for AI capabilities
- Maintains chat history and server connections

### BackendOld (`/backendOld`)
- Initial experimentation backend implementation
- Contains previous versions of the server implementation
- Maintained for reference and historical purposes

## Key Features

- **MCP Server Integration**: Connect to various AI-powered MCP servers
- **Real-time Chat**: Interactive chat interface with immediate responses
- **Server Recommendations**: AI-powered server recommendations based on user queries
- **Chat History**: Persistent chat history with support for multiple conversations
- **Code Highlighting**: Syntax highlighting for code blocks in chat messages
- **Markdown Support**: Rich text formatting in chat messages

## API Endpoints

### Server Management
- `GET /servers` - List all available MCP servers
- `GET /servers/recommend` - Get server recommendations based on query
- `POST /connect` - Connect to an MCP server
- `POST /disconnect` - Disconnect from an MCP server

### Chat
- `POST /chat` - Send a message and get AI response
- `GET /chats` - List all chats
- `GET /chats/:id` - Get specific chat by ID
- `POST /chats` - Create a new chat

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd backendBee
   npm install
   ```
3. Set up environment variables (see `.env.example`)
4. Start the development servers:
   ```bash
   # Frontend
   cd frontend
   npm run dev

   # Backend
   cd backendBee
   npm run dev
   ```

## Environment Variables

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL

### Backend
- `PORT`: Server port (default: 3001)
- `BRAVE_API_KEY`: API key for Brave search integration

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
