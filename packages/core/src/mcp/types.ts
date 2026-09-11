/** One entry of `team.yaml`'s `mcp.servers` \u2014 how to launch a single MCP server over stdio. */
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPToolDescriptor {
  /** The server this tool came from, so agents/logs can disambiguate identically-named tools. */
  server: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface MCPToolCallResult {
  content: string;
  isError: boolean;
}

/**
 * Abstraction over Model Context Protocol servers so core never depends on a
 * specific transport or SDK. `MCPClientProvider` (`@crewforge/integrations`) is the
 * only implementation today, built on the official `@modelcontextprotocol/sdk`.
 */
export interface MCPProvider {
  /** Connects to every configured server (best-effort per server; see `MCPProvider` docs). */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPToolDescriptor[]>;
  callTool(server: string, tool: string, args: Record<string, unknown>): Promise<MCPToolCallResult>;
}
