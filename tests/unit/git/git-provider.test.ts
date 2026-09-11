import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalGitProvider, NotImplementedError } from '@crewforge/core';

const execFileAsync = promisify(execFile);

describe('LocalGitProvider', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'crewforge-git-'));
    await git(repoRoot, ['init', '--initial-branch=main']);
    await git(repoRoot, ['config', 'user.email', 'test@example.com']);
    await git(repoRoot, ['config', 'user.name', 'Test']);
    await writeFile(join(repoRoot, 'README.md'), '# hello\n');
    await git(repoRoot, ['add', '-A']);
    await git(repoRoot, ['commit', '-m', 'initial commit']);
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('reports a clean status right after commit', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    const status = await provider.status();
    expect(status.branch).toBe('main');
    expect(status.clean).toBe(true);
    expect(status.entries).toEqual([]);
  });

  it('reports modified and untracked files', async () => {
    await writeFile(join(repoRoot, 'README.md'), '# hello world\n');
    await writeFile(join(repoRoot, 'NEW.md'), '# new file\n');

    const provider = new LocalGitProvider({ cwd: repoRoot });
    const status = await provider.status();

    expect(status.clean).toBe(false);
    expect(status.entries).toEqual(
      expect.arrayContaining([
        { path: 'README.md', status: 'modified' },
        { path: 'NEW.md', status: 'untracked' },
      ]),
    );
  });

  it('diff() reports changed files and a non-empty patch', async () => {
    await writeFile(join(repoRoot, 'README.md'), '# hello world\n');

    const provider = new LocalGitProvider({ cwd: repoRoot });
    const diff = await provider.diff();

    expect(diff.files).toEqual(['README.md']);
    expect(diff.patch).toContain('hello world');
  });

  it('commit() adds and commits changes, returning the new commit sha', async () => {
    await writeFile(join(repoRoot, 'README.md'), '# hello world\n');

    const provider = new LocalGitProvider({ cwd: repoRoot });
    const sha = await provider.commit('update readme');

    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    const status = await provider.status();
    expect(status.clean).toBe(true);
  });

  it('createBranch() creates and switches to a new branch', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    await provider.createBranch('feature/x');
    const status = await provider.status();
    expect(status.branch).toBe('feature/x');
  });

  it('createWorktree() is not yet implemented (deferred to a later phase)', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    await expect(provider.createWorktree('../wt', 'feature/x')).rejects.toThrow(
      NotImplementedError,
    );
  });
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}
