/**
 * MCP Registry — manage user's connected MCP servers in the database.
 */

import { query, queryOne } from "./db";

export interface MCPConnection {
  id: string;
  userId: string;
  serverName: string;
  serverUrl: string;
  transport: string;
  isActive: boolean;
  createdAt: string;
}

/** Add a new MCP server connection for a user */
export async function addConnection(
  userId: string,
  serverName: string,
  serverUrl: string,
  transport: string = "sse"
): Promise<MCPConnection> {
  const row = await queryOne<any>(
    `INSERT INTO mcp_connections (user_id, server_name, server_url, transport)
     VALUES ($1, $2, $3, $4)
     RETURNING id, server_name, server_url, transport, is_active, created_at`,
    [userId, serverName, serverUrl, transport]
  );
  return mapRow(userId, row);
}

/** List all connections for a user */
export async function listConnections(userId: string): Promise<MCPConnection[]> {
  const rows = await query<any>(
    `SELECT id, server_name, server_url, transport, is_active, created_at
     FROM mcp_connections WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => mapRow(userId, r));
}

/** Get a single connection (verifies ownership) */
export async function getConnection(
  connectionId: string,
  userId: string
): Promise<MCPConnection | null> {
  const row = await queryOne<any>(
    `SELECT id, server_name, server_url, transport, is_active, created_at
     FROM mcp_connections WHERE id = $1 AND user_id = $2`,
    [connectionId, userId]
  );
  if (!row) return null;
  return mapRow(userId, row);
}

/** Remove a connection */
export async function removeConnection(
  connectionId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    "DELETE FROM mcp_connections WHERE id = $1 AND user_id = $2 RETURNING id",
    [connectionId, userId]
  );
  return result.length > 0;
}

/** Toggle connection active status */
export async function toggleConnection(
  connectionId: string,
  userId: string,
  isActive: boolean
): Promise<void> {
  await query(
    "UPDATE mcp_connections SET is_active = $1 WHERE id = $2 AND user_id = $3",
    [isActive, connectionId, userId]
  );
}

function mapRow(userId: string, row: any): MCPConnection {
  return {
    id: row.id,
    userId,
    serverName: row.server_name,
    serverUrl: row.server_url,
    transport: row.transport,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}
