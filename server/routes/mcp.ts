import { Router } from "express";
import { requireAuth } from "../middleware";

export const mcpRouter = Router();

const mcpImports = {
  registry: require("../mcp-registry") as typeof import("../mcp-registry"),
  client: require("../mcp-client") as typeof import("../mcp-client"),
};

mcpRouter.get("/mcp/connections", requireAuth, async (req, res) => {
  try {
    const connections = await mcpImports.registry.listConnections(req.userId!);
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

mcpRouter.post("/mcp/connections", requireAuth, async (req, res) => {
  try {
    const { serverName, serverUrl, transport } = req.body;
    if (!serverName || !serverUrl) return res.status(400).json({ error: "serverName and serverUrl required" });

    const conn = await mcpImports.registry.addConnection(req.userId!, serverName, serverUrl, transport);

    const tools = await mcpImports.client.connectToServer(conn.id, serverUrl, serverName);
    res.json({ connection: conn, tools });
  } catch (err) {
    console.error("MCP connection error:", err);
    res.status(500).json({ error: "Failed to add connection" });
  }
});

mcpRouter.delete("/mcp/connections/:id", requireAuth, async (req, res) => {
  try {
    await mcpImports.client.disconnectServer(req.params.id as string);
    const removed = await mcpImports.registry.removeConnection(req.params.id as string, req.userId!);
    if (!removed) return res.status(404).json({ error: "Connection not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove connection" });
  }
});

mcpRouter.post("/mcp/tools/:connectionId/call", requireAuth, async (req, res) => {
  try {
    const { tool, args } = req.body;
    if (!tool) return res.status(400).json({ error: "tool name required" });

    const conn = await mcpImports.registry.getConnection(req.params.connectionId as string, req.userId!);
    if (!conn) return res.status(404).json({ error: "Connection not found" });

    const result = await mcpImports.client.executeTool(conn.id, tool, args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Tool execution failed" });
  }
});
