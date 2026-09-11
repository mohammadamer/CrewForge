import type { RepositorySummary } from '../context/types.js';
import type {
  VerificationCommandConfig,
  VerificationRunner,
  VerificationSummary,
} from '../verification/types.js';
import type { Task } from '../tasks/types.js';
import { detectConflicts } from './conflict-detector.js';
import type { ConflictGroup } from './conflict-detector.js';
import { LeadAgent } from './lead-agent.js';
import type { LeadAgentOptions, RunSummary, WorktreeConflict } from './lead-agent.js';

export interface ResolvedConflict extends ConflictGroup {
  suggestedResolution?: string;
}

export interface VerificationStageOptions {
  runner: VerificationRunner;
  config: VerificationCommandConfig;
  /** Mirrors `team.yaml`'s `workflow.verification` toggle. */
  enabled: boolean;
}

export interface RunOrchestratorOptions extends LeadAgentOptions {
  verification?: VerificationStageOptions;
  /** Best-effort, AI-driven conflict analysis; omit to just escalate with no suggestion. */
  resolveConflict?: (conflict: ConflictGroup, tasks: Task[]) => Promise<string | undefined>;
}

export interface OrchestrationSummary extends RunSummary {
  conflicts: ResolvedConflict[];
  verification?: VerificationSummary;
}

export type { WorktreeConflict };

/**
 * Wraps `LeadAgent.run()` with the two post-implementation stages build.md calls out
 * separately from task delegation: conflict detection (never silently discard work)
 * and verification (run the repo's real test/lint/build commands). Both stages can
 * demote an already-`completed` task back to `needs-review` for human attention.
 */
export async function executeRun(
  request: string,
  repository: RepositorySummary,
  options: RunOrchestratorOptions,
): Promise<OrchestrationSummary> {
  const lead = new LeadAgent(options);
  const summary = await lead.run(request, repository);

  const conflicts = await resolveConflicts(summary, options.resolveConflict);
  const verification = await runVerificationStage(summary, options.verification);

  const tasks = summary.graph.listTasks();
  return {
    graph: summary.graph,
    completed: tasks.filter((task) => task.status === 'completed' || task.status === 'approved'),
    failed: tasks.filter((task) => task.status === 'failed'),
    needsReview: tasks.filter((task) => task.status === 'needs-review'),
    worktreeConflicts: summary.worktreeConflicts,
    conflicts,
    verification,
  };
}

async function resolveConflicts(
  summary: RunSummary,
  resolveConflict: RunOrchestratorOptions['resolveConflict'],
): Promise<ResolvedConflict[]> {
  const rawConflicts = detectConflicts(summary.graph.listTasks());
  const resolved: ResolvedConflict[] = [];

  for (const conflict of rawConflicts) {
    const suggestedResolution = await resolveConflict?.(conflict, summary.graph.listTasks());
    resolved.push({ ...conflict, suggestedResolution });

    for (const taskId of conflict.taskIds) {
      if (summary.graph.getTask(taskId).status === 'completed') {
        summary.graph.setStatus(taskId, 'needs-review');
      }
    }
  }

  return resolved;
}

async function runVerificationStage(
  summary: RunSummary,
  verification: VerificationStageOptions | undefined,
): Promise<VerificationSummary | undefined> {
  if (!verification?.enabled) return undefined;

  const hasAnyCommand = Object.values(verification.config).some(Boolean);
  if (!hasAnyCommand) return undefined;

  const result = await verification.runner.run(verification.config);
  if (!result.passed) {
    for (const task of summary.graph.listTasks()) {
      if (task.status === 'completed') {
        summary.graph.setStatus(task.id, 'needs-review');
      }
    }
  }
  return result;
}
