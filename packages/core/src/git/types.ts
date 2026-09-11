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

/** Abstraction over Git so orchestration never shells out directly. See `LocalGitProvider`. */
export interface GitProvider {
  status(): Promise<GitStatus>;
  diff(paths?: string[]): Promise<GitDiffResult>;
  createBranch(name: string): Promise<void>;
  /** Isolated worktrees for parallel task execution; out of scope until Phase 6. */
  createWorktree(path: string, branch: string): Promise<void>;
  commit(message: string, paths?: string[]): Promise<string>;
  merge(branch: string): Promise<void>;
}
