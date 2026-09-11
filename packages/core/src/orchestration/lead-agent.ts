import type { AgentRegistry } from '../agents/registry.js';
import type { RepositorySummary } from '../context/types.js';
import type { WorktreeCoordinator } from '../git/worktree-coordinator.js';
import { TaskGraph } from '../tasks/task-graph.js';
import type { Task } from '../tasks/types.js';
import type { AgentExecutor } from './agent-executor.js';
import { Scheduler } from './scheduler.js';
import type { TaskPlanner } from './task-planner.js';

export interface WorktreeConflict {
  taskId: string;
  branch: string;
  output: string;
}

export interface LeadAgentOptions {
  registry: AgentRegistry;
  planner: TaskPlanner;
  executor: AgentExecutor;
  concurrency?: number;
  /** When set, each task runs in its own isolated git worktree (`team.yaml`'s `workflow.worktrees`). */
  worktrees?: WorktreeCoordinator;
}

export interface RunSummary {
  graph: TaskGraph;
  completed: Task[];
  failed: Task[];
  needsReview: Task[];
  worktreeConflicts: WorktreeConflict[];
}

/**
 * Orchestrates a single run: plan the task graph, delegate to specialists (in
 * parallel where possible), collect results, and summarize. The Lead never
 * implements tasks itself \u2014 that's always delegated through `AgentExecutor`.
 */
export class LeadAgent {
  private readonly registry: AgentRegistry;
  private readonly planner: TaskPlanner;
  private readonly executor: AgentExecutor;
  private readonly scheduler: Scheduler;
  private readonly worktrees?: WorktreeCoordinator;
  private readonly worktreeConflicts: WorktreeConflict[] = [];

  constructor(options: LeadAgentOptions) {
    this.registry = options.registry;
    this.planner = options.planner;
    this.executor = options.executor;
    this.scheduler = new Scheduler({ concurrency: options.concurrency });
    this.worktrees = options.worktrees;
  }

  async run(request: string, repository: RepositorySummary): Promise<RunSummary> {
    const availableRoles = this.registry.list().map((agent) => agent.role);
    const plannedTasks = await this.planner.plan(request, repository, availableRoles);

    const graph = new TaskGraph();
    for (const task of plannedTasks) {
      graph.addTask(task);
    }

    await this.scheduler.run(graph, (task) => this.runTask(graph, task));
    this.blockStuckTasks(graph);

    const tasks = graph.listTasks();
    return {
      graph,
      completed: tasks.filter((task) => task.status === 'completed' || task.status === 'approved'),
      failed: tasks.filter((task) => task.status === 'failed'),
      needsReview: tasks.filter((task) => task.status === 'needs-review'),
      worktreeConflicts: this.worktreeConflicts,
    };
  }

  private async runTask(graph: TaskGraph, task: Task): Promise<void> {
    if (!task.owner) {
      // Unassigned tasks are surfaced for triage rather than silently skipped.
      graph.setStatus(task.id, 'needs-review');
      return;
    }
    if (!this.registry.has(task.owner)) {
      graph.recordOutcome(task.id, { errors: [`No agent registered for role "${task.owner}"`] });
      graph.setStatus(task.id, 'failed');
      return;
    }

    graph.setStatus(task.id, 'running');
    const agent = this.registry.get(task.owner);
    const worktree = await this.worktrees?.prepare(task.id);

    try {
      const result = await this.executor.execute(task, agent, graph, { cwd: worktree?.path });
      graph.recordOutcome(task.id, {
        artifacts: result.artifacts,
        result: { summary: result.summary, filesChanged: result.filesChanged },
        errors: result.errors,
      });

      const conflicted = worktree ? await this.finalizeWorktree(task, worktree) : false;
      graph.setStatus(
        task.id,
        conflicted ? 'needs-review' : result.success ? 'completed' : 'failed',
      );
    } catch (error) {
      if (worktree) await this.finalizeWorktree(task, worktree);
      graph.recordOutcome(task.id, {
        errors: [error instanceof Error ? error.message : String(error)],
      });
      graph.setStatus(task.id, 'failed');
    }
  }

  /** Merges the task's worktree branch back in; returns true when a real conflict blocked it. */
  private async finalizeWorktree(
    task: Task,
    worktree: NonNullable<Awaited<ReturnType<WorktreeCoordinator['prepare']>>>,
  ): Promise<boolean> {
    const result = await this.worktrees!.finalize(worktree);
    if (result.conflicted) {
      this.worktreeConflicts.push({
        taskId: task.id,
        branch: worktree.branch,
        output: result.output,
      });
    }
    return result.conflicted;
  }

  /** Tasks that never became ready (e.g. a dependency failed) are surfaced, not left pending. */
  private blockStuckTasks(graph: TaskGraph): void {
    for (const task of graph.listTasks()) {
      if (task.status === 'pending') {
        graph.setStatus(task.id, 'blocked');
      }
    }
  }
}
