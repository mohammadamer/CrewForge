import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockRuntime } from '@crewforge/runtime';
import { runInit, runMcpList, runRun } from '@crewforge/cli';

describe('MCP (integration)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-mcp-'));
    await runInit({ cwd });

    const teamYamlPath = join(cwd, '.crewforge', 'team.yaml');
    const content = await readFile(teamYamlPath, 'utf8');
    await writeFile(
      teamYamlPath,
      `${content}\nmcp:\n  servers:\n    - name: broken\n      command: this-binary-does-not-exist-xyz\n      args: []\n`,
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('crewforge mcp reports a connection failure without throwing', async () => {
    const result = await runMcpList(cwd);

    expect(result.configuredServers).toEqual(['broken']);
    expect(result.tools).toEqual([]);
    expect(result.connectionErrors).toHaveLength(1);
    expect(result.connectionErrors[0]?.server).toBe('broken');
  });

  it('crewforge run never fails because a configured MCP server is unreachable', async () => {
    const messages: string[] = [];
    const outcome = await runRun({
      cwd,
      request: 'Add a health check endpoint',
      runtime: new MockRuntime(),
      onEvent: (event) => {
        if (event.type === 'agent-message') messages.push(JSON.stringify(event.data));
      },
    });

    expect(outcome.sessionSummary.tasksFailed).toBe(0);
    expect(messages.some((message) => message.includes('broken'))).toBe(true);
  });
});
