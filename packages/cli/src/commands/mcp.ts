import { loadTeamConfig } from '@crewforge/core';
import type { MCPToolDescriptor } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';
import { connectConfiguredMcpServers } from '../mcp.js';

export interface McpListResult {
  configuredServers: string[];
  connectionErrors: Array<{ server: string; error: string }>;
  tools: MCPToolDescriptor[];
}

/** Connects to every configured MCP server, lists their tools, then disconnects. */
export async function runMcpList(cwd: string): Promise<McpListResult> {
  const teamConfig = await loadTeamConfig(crewforgeDirFor(cwd));
  const configuredServers = (teamConfig.mcp?.servers ?? []).map((server) => server.name);

  const connection = await connectConfiguredMcpServers(teamConfig);
  if (!connection) {
    return { configuredServers, connectionErrors: [], tools: [] };
  }

  try {
    const tools = await connection.provider.listTools();
    return {
      configuredServers,
      connectionErrors: connection.connectionErrors.map(({ server, error }) => ({
        server,
        error: String(error),
      })),
      tools,
    };
  } finally {
    await connection.provider.disconnect();
  }
}
