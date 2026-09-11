import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { MockRuntime } from '@crewforge/runtime';
import { runInit, runRun } from '@crewforge/cli';

const execFileAsync = promisify(execFile);

async function enableWorktrees(cwd: string): Promise<void> {
  const teamYamlPath = join(cwd, '.crewforge', 'team.yaml');
  const content = await readFile(teamYamlPath, 'utf8');
  await writeFile(teamYamlPath, content.replace('worktrees: false', 'worktrees: true'));
}

describe('workflow.worktrees (integration)', () => {
  let cwd: string;

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('runs each task in an isolated worktree and cleans up after a clean run', async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-worktrees-'));
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd });
    await writeFile(join(cwd, 'README.md'), '# demo\n');
    await execFileAsync('git', ['add', '-A'], { cwd });
    await execFileAsync('git', ['commit', '-m', 'initial commit'], { cwd });

    await runInit({ cwd });
    await enableWorktrees(cwd);

    const outcome = await runRun({
      cwd,
      request: 'Add a health check endpoint',
      runtime: new MockRuntime(),
    });

    expect(outcome.summary.worktreeConflicts).toEqual([]);
    expect(outcome.sessionSummary.tasksFailed).toBe(0);
    expect(outcome.sessionSummary.tasksCompleted).toBeGreaterThan(0);

    // Every worktree is cleaned up once its task finalizes, win or lose.
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], { cwd });
    expect(stdout.trim().split('\n\n').filter(Boolean)).toHaveLength(1); // just the main checkout
    await expect(readdir(join(cwd, '.crewforge', 'worktrees')).catch(() => [])).resolves.toEqual(
      [],
    );
  });

  it('refuses to run with workflow.worktrees enabled outside a git repository', async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-worktrees-nogit-'));
    await runInit({ cwd });
    await enableWorktrees(cwd);

    await expect(
      runRun({ cwd, request: 'Add a health check endpoint', runtime: new MockRuntime() }),
    ).rejects.toThrow(/workflow\.worktrees is enabled but this is not a git repository/);
  });
});
