export interface SessionSummary {
  runId: string;
  request: string;
  createdAt: string;
  completedAt: string;
  durationMs: number;
  /** Number of tasks executed per agent role. */
  agentCounts: Record<string, number>;
  filesChanged: string[];
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksNeedsReview: number;
}
