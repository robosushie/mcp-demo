// example-usage.ts
// Example of how to use the MCP Chat Backend API

const API_BASE = 'http://localhost:3001';
const SESSION_ID = 'user-123';

async function exampleFlow() {
  console.log('🚀 MCP Chat Backend Example Usage\n');

  // Step 1: List all available MCP servers
  console.log('1. Fetching available MCP servers...');
  const serversResponse = await fetch(`${API_BASE}/api/mcp/servers`);
  const { servers } = await serversResponse.json();
  console.log(`Found ${servers.length} MCP servers:`);
  servers.forEach((s: any) => console.log(`  - ${s.name}: ${s.description}`));
  console.log();

  // Step 2: Get recommendations based on user need
  console.log('2. Getting recommendations for "I need to search the web and write code"...');
  const recommendResponse = await fetch(`${API_BASE}/api/mcp/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'I need to search the web find a blog called on Model context protocol and scrape the content',
      useAI: true
    })
  });
  const { recommendations } = await recommendResponse.json();
  console.log('Recommended servers:');
  recommendations.forEach((s: any) => console.log(`  - ${s.name}`));
  console.log();

  // Step 3: Connect to recommended servers
  console.log('3. Connecting to recommended servers...');
  const serverIds = recommendations.map((s: any) => s.id);
  const connectResponse = await fetch(`${API_BASE}/api/mcp/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      serverIds
    })
  });
  const { connectedServers } = await connectResponse.json();
  console.log('Connected servers:');
  connectedServers.forEach((s: any) => 
    console.log(`  - ${s.id}: ${s.status}`)
  );
  console.log();

  // Step 4: List available tools
  console.log('4. Listing available tools...');
  const toolsResponse = await fetch(`${API_BASE}/api/mcp/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION_ID })
  });
  const { tools } = await toolsResponse.json();
  console.log(`Found ${tools.length} tools:`);
  tools.forEach((t: any) => 
    console.log(`  - [${t.serverId}] ${t.name}: ${t.description}`)
  );
  console.log();

  // Step 5: Chat with MCP tools
  console.log('5. Sending a chat message that uses MCP tools...');
  const chatResponse = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      messages: [
        {
          role: 'user',
          content: 'Search the web find a blog called on Model context protocol and scrape the content'
        }
      ],
      useMCP: true
    })
  });
  const chatResult = await chatResponse.json();
  console.log('AI Response:', chatResult.message.content);

  const chatResponse2 = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      messages: [
        {
          role: 'user',
          content: 'Scrape the content of the first blog and give the results'
        }
      ],
      useMCP: true
    })
  });
  const chatResult2 = await chatResponse2.json();
  console.log('AI Response:', chatResult2.message.content);

  console.log(chatResult2.message.content);

  if (chatResult.toolCalls) {
    console.log('\nTools used:');
    chatResult.toolCalls.forEach((tc: any) => 
      console.log(`  - ${tc.function.name}`)
    );
  }
  console.log();

  // Step 6: Disconnect
  console.log('6. Disconnecting from MCP servers...');
  const disconnectResponse = await fetch(`${API_BASE}/api/mcp/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION_ID })
  });
  const { disconnected } = await disconnectResponse.json();
  console.log(`Disconnected from ${disconnected.length} servers`);
}

// Run the example
exampleFlow().catch(console.error);