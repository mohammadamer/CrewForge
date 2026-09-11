import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  GitDiffResult,
  GitProvider,
  GitStatus,
  GitStatusEntry,
  MergeResult,
} from './types.js';

const execFileAsync = promisify(execFile);

interface ExecFileError {
  stdout?: string;
  stderr?: string;
}

function isExecFileError(error: unknown): error is ExecFileError {
  return typeof error === 'object' && error !== null && ('stdout' in error || 'stderr' in error);
}

export interface LocalGitProviderOptions {
  cwd: string;
}

/**
 * `GitProvider` backed directly by the system `git` binary via `execFile` (argv arrays,
 * never a shell string) — no `simple-git` dependency needed for these few plumbing commands.
 */
export class LocalGitProvider implements GitProvider {
  constructor(private readonly options: LocalGitProviderOptions) {}

  async status(): Promise<GitStatus> {
    const branch = (await this.git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    const porcelain = await this.git(['status', '--porcelain']);
    const entries = parsePorcelainStatus(porcelain);
    return { branch, entries, clean: entries.length === 0 };
  }

  async diff(paths?: string[]): Promise<GitDiffResult> {
    const scope = paths?.length ? ['--', ...paths] : [];
    const patch = await this.git(['diff', ...scope]);
    const nameOnly = await this.git(['diff', '--name-only', ...scope]);
    return { patch, files: splitLines(nameOnly) };
  }

  async createBranch(name: string): Promise<void> {
    await this.git(['checkout', '-b', name]);
  }

  async createWorktree(path: string, branch: string): Promise<void> {
    await this.git(['worktree', 'add', '-b', branch, path]);
  }

  async removeWorktree(path: string): Promise<void> {
    await this.git(['worktree', 'remove', '--force', path]);
  }

  async commit(message: string, paths?: string[]): Promise<string> {
    await this.git(paths?.length ? ['add', '--', ...paths] : ['add', '-A']);
    await this.git(['commit', '-m', message]);
    return (await this.git(['rev-parse', 'HEAD'])).trim();
  }

  async merge(branch: string): Promise<MergeResult> {
    try {
      const output = await this.git(['merge', '--no-edit', branch]);
      return { merged: true, conflicted: false, output };
    } catch (error) {
      // A real conflict is the only failure we treat as recoverable — abort and report it
      // rather than leaving the tree in a conflicted state for the caller to clean up.
      const output = isExecFileError(error) ? (error.stdout ?? '') + (error.stderr ?? '') : '';
      await this.git(['merge', '--abort']).catch(() => undefined);
      return { merged: false, conflicted: true, output: output || String(error) };
    }
  }

  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: this.options.cwd });
    return stdout;
  }
}

function splitLines(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Maps `git status --porcelain` two-letter status codes to a single `GitStatusEntry` status. */
function parsePorcelainStatus(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  for (const rawLine of output.split('\n')) {
    // Unlike diff output, a leading space here is part of the significant 2-char
    // status code, so only strip a trailing '\r' (Windows) — never trim leading space.
    const line = rawLine.replace(/\r$/, '');
    if (!line) continue;

    const code = line.slice(0, 2);
    const rawPath = line.slice(3);
    const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;

    entries.push({ path, status: statusFromCode(code) });
  }
  return entries;
}

function statusFromCode(code: string): GitStatusEntry['status'] {
  if (code === '??') return 'untracked';
  if (code.includes('R')) return 'renamed';
  if (code.includes('D')) return 'deleted';
  if (code.includes('A')) return 'added';
  return 'modified';
}
