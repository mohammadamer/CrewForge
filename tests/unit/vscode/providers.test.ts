import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit, runTaskCreate } from '@crewforge/cli';
import {
  ChangedFilesTreeProvider,
  DecisionsTreeProvider,
  TaskTreeProvider,
  TeamTreeProvider,
} from '@crewforge/vscode';

describe('CrewForge VS Code tree providers', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-vscode-'));
    await runInit({ cwd, name: 'demo-team' });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('TeamTreeProvider lists the team header row plus one row per agent', async () => {
    const provider = new TeamTreeProvider(cwd);
    const rows = await provider.getChildren();

    expect(rows[0]).toEqual({ label: 'demo-team', description: 'lead: lead', isHeader: true });
    expect(
      rows
        .slice(1)
        .map((row) => row.label)
        .sort(),
    ).toEqual(['backend', 'frontend', 'lead', 'qa'].sort());

    const item = provider.getTreeItem(rows[0]!);
    expect(item.label).toBe('demo-team');
  });

  it('TaskTreeProvider reflects a manually created task', async () => {
    const { runId } = await runTaskCreate({ cwd, title: 'Investigate flaky test' });
    const provider = new TaskTreeProvider(cwd);
    const tasks = await provider.getChildren();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Investigate flaky test');
    const item = provider.getTreeItem(tasks[0]!);
    expect(item.description).toContain('pending');
    void runId;
  });

  it('DecisionsTreeProvider is empty for a freshly initialized repository', async () => {
    const provider = new DecisionsTreeProvider(cwd);
    expect(await provider.getChildren()).toEqual([]);
  });

  it('DecisionsTreeProvider lists an ADR written directly to .crewforge/decisions', async () => {
    await writeFile(
      join(cwd, '.crewforge', 'decisions', 'ADR-001-example.md'),
      '# Use PostgreSQL\n\nDecision: ...\n',
    );

    const provider = new DecisionsTreeProvider(cwd);
    const decisions = await provider.getChildren();

    expect(decisions).toEqual([{ id: 'ADR-001-example', title: 'Use PostgreSQL' }]);
  });

  it('ChangedFilesTreeProvider is empty before any run', async () => {
    const provider = new ChangedFilesTreeProvider(cwd);
    expect(await provider.getChildren()).toEqual([]);
  });
});
