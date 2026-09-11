import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClientProvider } from '@crewforge/integrations';

/** Spins up a real in-process MCP server (no subprocess) exposing one `echo` tool. */
async function startEchoServer(): Promise<{
  clientTransport: Transport;
}> {
  const server = new McpServer({ name: 'echo-server', version: '1.0.0' });
  server.registerTool(
    'echo',
    {
      description: 'Echoes the given message back',
      inputSchema: { message: z.string() },
    },
    ({ message }: { message: string }) => ({
      content: [{ type: 'text', text: `echo: ${message}` }],
    }),
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  return { clientTransport };
}

describe('McpClientProvider', () => {
  let provider: McpClientProvider | undefined;

  afterEach(async () => {
    await provider?.disconnect();
    provider = undefined;
  });

  it('connects, lists real tools, and calls one end to end', async () => {
    const { clientTransport } = await startEchoServer();

    provider = new McpClientProvider({
      servers: [{ name: 'echo', command: 'unused', args: [] }],
      createTransport: () => clientTransport,
    });
    await provider.connect();

    const tools = await provider.listTools();
    expect(tools).toEqual([
      expect.objectContaining({ server: 'echo', name: 'echo', description: expect.any(String) }),
    ]);

    const result = await provider.callTool('echo', 'echo', { message: 'hello' });
    expect(result).toEqual({ content: 'echo: hello', isError: false });
  });

  it('reports a connection failure without throwing, and skips that server', async () => {
    const errors: Array<{ server: string; error: unknown }> = [];
    provider = new McpClientProvider({
      servers: [{ name: 'broken', command: 'unused', args: [] }],
      createTransport: () => {
        throw new Error('spawn failed');
      },
      onConnectionError: (server, error) => errors.push({ server, error }),
    });

    await provider.connect();

    expect(errors).toHaveLength(1);
    expect(errors[0]?.server).toBe('broken');
    expect(await provider.listTools()).toEqual([]);
  });

  it('throws a clear error calling a tool on a server that never connected', async () => {
    provider = new McpClientProvider({ servers: [] });
    await provider.connect();

    await expect(provider.callTool('missing', 'echo', {})).rejects.toThrow(
      /MCP server "missing" is not connected/,
    );
  });
});
