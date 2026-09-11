import { join } from 'node:path';
import type { GitProvider, MergeResult } from './types.js';

export interface WorktreeCoordinatorOptions {
  /** The main repository's `GitProvider`, used to merge task branches back in. */
  gitProvider: GitProvider;
  /** Builds a `GitProvider` scoped to a worktree's own directory. */
  createGitProvider: (cwd: string) => GitProvider;
  /** Directory worktrees are created under, e.g. `<repo>/.crewforge/worktrees`. */
  worktreesDir: string;
}

export interface PreparedWorktree {
  taskId: string;
  path: string;
  branch: string;
  /** Scoped to `path` — pass this to the task's `AgentExecutor` call. */
  gitProvider: GitProvider;
}

export interface WorktreeFinalizeResult extends MergeResult {
  /** True when the worktree had any commits/changes worth merging at all. */
  hadChanges: boolean;
}

/**
 * Gives each parallel task its own git worktree so agents never edit the same working
 * tree concurrently. `finalize()` commits any changes made inside the worktree, merges
 * the task's branch back into the caller's current branch, and always cleans the
 * worktree up — even when the merge conflicts, in which case the caller is told so it
 * can flag the task for human review instead of silently losing or overwriting work.
 */
export class WorktreeCoordinator {
  /** Serializes prepare/finalize calls: concurrent `git worktree add`/`merge` against the
   *  same repo can race on git's own lock files, even though task execution itself (which
   *  happens between a `prepare()` and its `finalize()`) still runs fully in parallel. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: WorktreeCoordinatorOptions) {}

  async prepare(taskId: string): Promise<PreparedWorktree> {
    return this.enqueue(async () => {
      const branch = `crewforge/task-${taskId}`;
      const path = join(this.options.worktreesDir, `task-${taskId}`);
      await this.options.gitProvider.createWorktree(path, branch);
      return { taskId, path, branch, gitProvider: this.options.createGitProvider(path) };
    });
  }

  async finalize(prepared: PreparedWorktree): Promise<WorktreeFinalizeResult> {
    return this.enqueue(async () => {
      try {
        const status = await prepared.gitProvider.status();
        const hadChanges = !status.clean;
        if (hadChanges) {
          await prepared.gitProvider.commit(`crewforge: ${prepared.taskId}`);
        }

        const merge = await this.options.gitProvider.merge(prepared.branch);
        return { ...merge, hadChanges };
      } finally {
        await this.options.gitProvider.removeWorktree(prepared.path);
      }
    });
  }

  /** Runs `fn` only after every previously queued call has settled, in FIFO order. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn, fn);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
