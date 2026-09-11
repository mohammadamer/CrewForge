import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalGitProvider, WorktreeCoordinator } from '@crewforge/core';

const execFileAsync = promisify(execFile);

describe('WorktreeCoordinator', () => {
  let repoRoot: string;
  let coordinator: WorktreeCoordinator;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'crewforge-wtc-'));
    await git(repoRoot, ['init', '--initial-branch=main']);
    await git(repoRoot, ['config', 'user.email', 'test@example.com']);
    await git(repoRoot, ['config', 'user.name', 'Test']);
    await writeFile(join(repoRoot, 'README.md'), '# hello\n');
    await git(repoRoot, ['add', '-A']);
    await git(repoRoot, ['commit', '-m', 'initial commit']);

    coordinator = new WorktreeCoordinator({
      gitProvider: new LocalGitProvider({ cwd: repoRoot }),
      createGitProvider: (cwd) => new LocalGitProvider({ cwd }),
      worktreesDir: join(repoRoot, '.crewforge', 'worktrees'),
    });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('prepare() creates an isolated worktree scoped to the task id', async () => {
    const prepared = await coordinator.prepare('task-1');

    expect(prepared.branch).toBe('crewforge/task-task-1');
    expect(prepared.path).toContain(join('.crewforge', 'worktrees', 'task-task-1'));
    expect((await prepared.gitProvider.status()).branch).toBe('crewforge/task-task-1');

    await coordinator.finalize(prepared);
  });

  it('finalize() commits, merges the branch back, and removes the worktree', async () => {
    const prepared = await coordinator.prepare('task-2');
    await writeFile(join(prepared.path, 'NEW.md'), '# new file\n');

    const result = await coordinator.finalize(prepared);

    expect(result).toEqual({
      hadChanges: true,
      merged: true,
      conflicted: false,
      output: expect.any(String),
    });
    await expect(readFile(join(repoRoot, 'NEW.md'), 'utf8')).resolves.toBe('# new file\n');

    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
    });
    expect(stdout).not.toContain('task-task-2');
  });

  it('finalize() with no changes is a clean no-op merge', async () => {
    const prepared = await coordinator.prepare('task-3');
    const result = await coordinator.finalize(prepared);

    expect(result.hadChanges).toBe(false);
    expect(result.merged).toBe(true);
    expect(result.conflicted).toBe(false);
  });

  it('finalize() reports a real conflict and still removes the worktree', async () => {
    const prepared = await coordinator.prepare('task-4');
    await writeFile(join(prepared.path, 'README.md'), '# from worktree\n');

    // Diverge the main branch's copy of the same file so the merge cannot be trivial.
    await writeFile(join(repoRoot, 'README.md'), '# from main\n');
    await new LocalGitProvider({ cwd: repoRoot }).commit('diverging change');

    const result = await coordinator.finalize(prepared);

    expect(result.hadChanges).toBe(true);
    expect(result.merged).toBe(false);
    expect(result.conflicted).toBe(true);

    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
    });
    expect(stdout).not.toContain('task-task-4');
  });
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}
