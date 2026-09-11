import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalGitProvider } from '@crewforge/core';

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

  it('createWorktree() creates an isolated checkout on a new branch', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    const worktreePath = join(repoRoot, '..', 'crewforge-wt-basic');

    try {
      await provider.createWorktree(worktreePath, 'feature/x');
      const worktreeProvider = new LocalGitProvider({ cwd: worktreePath });
      const status = await worktreeProvider.status();
      expect(status.branch).toBe('feature/x');

      // The main repo's own checkout is untouched by creating the worktree.
      expect((await provider.status()).branch).toBe('main');
    } finally {
      await rm(worktreePath, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('removeWorktree() cleans up a previously created worktree', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    const worktreePath = join(repoRoot, '..', 'crewforge-wt-remove');

    await provider.createWorktree(worktreePath, 'feature/remove-me');
    await provider.removeWorktree(worktreePath);

    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
    });
    expect(stdout).not.toContain('crewforge-wt-remove');
  });

  it('merge() cleanly merges a worktree branch\u2019s commit into the current branch', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    const worktreePath = join(repoRoot, '..', 'crewforge-wt-merge');

    try {
      await provider.createWorktree(worktreePath, 'feature/merge-me');
      await writeFile(join(worktreePath, 'FEATURE.md'), '# feature\n');
      await new LocalGitProvider({ cwd: worktreePath }).commit('add feature file');

      const result = await provider.merge('feature/merge-me');

      expect(result.merged).toBe(true);
      expect(result.conflicted).toBe(false);
      expect((await provider.status()).entries).toEqual([]);
    } finally {
      await provider.removeWorktree(worktreePath).catch(() => undefined);
    }
  });

  it('merge() aborts and reports conflicted:true on a real conflict, leaving a clean tree', async () => {
    const provider = new LocalGitProvider({ cwd: repoRoot });
    const worktreePath = join(repoRoot, '..', 'crewforge-wt-conflict');

    try {
      await provider.createWorktree(worktreePath, 'feature/conflict-me');
      await writeFile(join(worktreePath, 'README.md'), '# from worktree\n');
      await new LocalGitProvider({ cwd: worktreePath }).commit('conflicting change');

      // Diverge the main branch's copy of the same file/line so the merge cannot be trivial.
      await writeFile(join(repoRoot, 'README.md'), '# from main\n');
      await provider.commit('diverging change');

      const result = await provider.merge('feature/conflict-me');

      expect(result.merged).toBe(false);
      expect(result.conflicted).toBe(true);
      // The merge was aborted, so the tree must be clean again (no MERGE_HEAD/conflict markers).
      expect((await provider.status()).clean).toBe(true);
    } finally {
      await provider.removeWorktree(worktreePath).catch(() => undefined);
    }
  });
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}
