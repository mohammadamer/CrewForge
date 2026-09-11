import type { TeamConfig } from '@crewforge/core';
import { McpClientProvider } from '@crewforge/integrations';

export interface McpConnectionResult {
  provider: McpClientProvider;
  connectionErrors: Array<{ server: string; error: unknown }>;
}

/** Connects to every `team.yaml`-configured MCP server; a single server failing to
 *  connect never blocks the others or the caller \u2014 see `connectionErrors`. Returns
 *  `undefined` when no servers are configured at all. */
export async function connectConfiguredMcpServers(
  teamConfig: TeamConfig,
): Promise<McpConnectionResult | undefined> {
  const servers = teamConfig.mcp?.servers ?? [];
  if (servers.length === 0) return undefined;

  const connectionErrors: Array<{ server: string; error: unknown }> = [];
  const provider = new McpClientProvider({
    servers,
    onConnectionError: (server, error) => connectionErrors.push({ server, error }),
  });
  await provider.connect();
  return { provider, connectionErrors };
}
