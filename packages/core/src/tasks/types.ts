/**
 * Lifecycle of a `Task`. The scheduler and Lead agent only move a task forward
 * along this sequence (see `packages/core/src/orchestration` for enforcement,
 * added in the task-graph phase).
 */
export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'needs-review'
  | 'approved';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'planning',
  'ready',
  'running',
  'blocked',
  'completed',
  'failed',
  'needs-review',
  'approved',
];

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'approved'];

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

export interface TaskArtifact {
  path: string;
  description?: string;
}

export interface TaskResult {
  summary: string;
  filesChanged: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** Agent role responsible for this task; undefined until the Lead triages it. */
  owner?: string;
  /** Ids of tasks that must reach a terminal, non-failed status before this one is ready. */
  dependencies: string[];
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts: TaskArtifact[];
  result?: TaskResult;
  errors: string[];
}
