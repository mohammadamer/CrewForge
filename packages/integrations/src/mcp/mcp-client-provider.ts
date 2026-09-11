import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  MCPProvider,
  MCPServerConfig,
  MCPToolCallResult,
  MCPToolDescriptor,
} from '@crewforge/core';

export interface McpClientProviderOptions {
  servers: MCPServerConfig[];
  /** Overridable so tests can connect over `InMemoryTransport` instead of spawning a real process. */
  createTransport?: (server: MCPServerConfig) => Transport;
  /** A server failing to connect never fails the whole run \u2014 it's reported here instead. */
  onConnectionError?: (server: string, error: unknown) => void;
}

/**
 * `MCPProvider` backed by the official `@modelcontextprotocol/sdk`. Connects to every
 * configured server over stdio (one child process per server), and never lets a single
 * unreachable server take down the others or the run itself.
 */
export class McpClientProvider implements MCPProvider {
  private readonly clients = new Map<string, Client>();

  constructor(private readonly options: McpClientProviderOptions) {}

  async connect(): Promise<void> {
    for (const server of this.options.servers) {
      try {
        const client = new Client({ name: 'crewforge', version: '0.1.0' });
        const transport = this.buildTransport(server);
        await client.connect(transport);
        this.clients.set(server.name, client);
      } catch (error) {
        this.options.onConnectionError?.(server.name, error);
      }
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([...this.clients.values()].map((client) => client.close()));
    this.clients.clear();
  }

  async listTools(): Promise<MCPToolDescriptor[]> {
    const descriptors: MCPToolDescriptor[] = [];
    for (const [serverName, client] of this.clients) {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        descriptors.push({
          server: serverName,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }
    return descriptors;
  }

  async callTool(
    server: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolCallResult> {
    const client = this.clients.get(server);
    if (!client) {
      throw new Error(`MCP server "${server}" is not connected`);
    }

    // Tool output is dynamic, server-defined JSON — read it defensively rather than
    // trusting the SDK's generic (and version-sensitive) inferred result shape.
    const result: unknown = await client.callTool({ name: tool, arguments: args });
    const items = isRecord(result) && Array.isArray(result.content) ? result.content : [];
    const content = items
      .filter((item): item is { type: 'text'; text: string } => isTextContentItem(item))
      .map((item) => item.text)
      .join('\n');
    return { content, isError: isRecord(result) ? Boolean(result.isError) : false };
  }

  private buildTransport(server: MCPServerConfig): Transport {
    if (this.options.createTransport) return this.options.createTransport(server);
    return new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: server.env,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTextContentItem(value: unknown): value is { type: 'text'; text: string } {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}
