/**
 * MCP Client — connects to MCP servers and executes tools.
 *
 * Supports SSE transport for remote MCP servers.
 * Discovers tools, executes them, and returns results to the AI.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
  connectionId: string;
}

export interface MCPToolResult {
  content: string;
  isError: boolean;
}

/** Active MCP client connections keyed by connectionId */
const activeClients = new Map<string, Client>();

/**
 * Connect to an MCP server via SSE transport.
 * Returns the list of available tools.
 */
export async function connectToServer(
  connectionId: string,
  serverUrl: string,
  serverName: string
): Promise<MCPTool[]> {
  try {
    const transport = new SSEClientTransport(new URL(serverUrl));
    const client = new Client({ name: "aura-mcp", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);
    activeClients.set(connectionId, client);

    const { tools } = await client.listTools();
    return (tools || []).map((t) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema as Record<string, unknown>,
      serverName,
      connectionId,
    }));
  } catch (err) {
    console.error(`[mcp] Failed to connect to ${serverName}:`, err);
    return [];
  }
}

/**
 * Execute a tool on a connected MCP server.
 */
export async function executeTool(
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<MCPToolResult> {
  const client = activeClients.get(connectionId);
  if (!client) {
    return { content: "MCP server not connected", isError: true };
  }

  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    const content = (result.content as any[])
      ?.map((c: any) => c.text || JSON.stringify(c))
      .join("\n") || "No result";
    return { content, isError: !!result.isError };
  } catch (err) {
    return { content: `Tool execution failed: ${(err as Error).message}`, isError: true };
  }
}

/**
 * Disconnect from an MCP server.
 */
export async function disconnectServer(connectionId: string): Promise<void> {
  const client = activeClients.get(connectionId);
  if (client) {
    try { await client.close(); } catch {}
    activeClients.delete(connectionId);
  }
}

/**
 * List all tools from all active connections.
 */
export async function listAllTools(): Promise<MCPTool[]> {
  const allTools: MCPTool[] = [];
  for (const [connectionId, client] of activeClients) {
    try {
      const { tools } = await client.listTools();
      for (const t of tools || []) {
        allTools.push({
          name: t.name,
          description: t.description || "",
          inputSchema: t.inputSchema as Record<string, unknown>,
          serverName: "",
          connectionId,
        });
      }
    } catch {}
  }
  return allTools;
}

/**
 * Build a tool descriptions string for injecting into the AI system prompt.
 */
export function buildToolPrompt(tools: MCPTool[]): string {
  if (tools.length === 0) return "";
  const lines = ["CONNECTED TOOLS (via MCP):"];
  for (const t of tools) {
    lines.push(`→ ${t.name}: ${t.description}`);
  }
  lines.push("\nTo use a tool, respond with: |||TOOL_CALL|||{\"tool\":\"name\",\"args\":{...}}");
  return lines.join("\n");
}
