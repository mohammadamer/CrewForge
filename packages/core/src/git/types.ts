export interface GitStatusEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
}

export interface GitStatus {
  branch: string;
  entries: GitStatusEntry[];
  clean: boolean;
}

export interface GitDiffResult {
  files: string[];
  patch: string;
}

export interface MergeResult {
  /** True when `branch` is now incorporated (including a trivial "already up to date"). */
  merged: boolean;
  /** True when the merge was aborted due to a real conflict; the tree is left clean. */
  conflicted: boolean;
  output: string;
}

/** Abstraction over Git so orchestration never shells out directly. See `LocalGitProvider`. */
export interface GitProvider {
  status(): Promise<GitStatus>;
  diff(paths?: string[]): Promise<GitDiffResult>;
  createBranch(name: string): Promise<void>;
  /** Creates an isolated worktree at `path` on a new `branch`, for parallel task execution. */
  createWorktree(path: string, branch: string): Promise<void>;
  /** Removes a worktree previously created by `createWorktree`. */
  removeWorktree(path: string): Promise<void>;
  commit(message: string, paths?: string[]): Promise<string>;
  /** Merges `branch` into the current branch; aborts (never leaves a conflicted tree) on conflict. */
  merge(branch: string): Promise<MergeResult>;
}
