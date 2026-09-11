import type { AgentRegistry } from '../agents/registry.js';
import type { RepositorySummary } from '../context/types.js';
import { TaskGraph } from '../tasks/task-graph.js';
import type { Task } from '../tasks/types.js';
import type { AgentExecutor } from './agent-executor.js';
import { Scheduler } from './scheduler.js';
import type { TaskPlanner } from './task-planner.js';

export interface LeadAgentOptions {
  registry: AgentRegistry;
  planner: TaskPlanner;
  executor: AgentExecutor;
  concurrency?: number;
}

export interface RunSummary {
  graph: TaskGraph;
  completed: Task[];
  failed: Task[];
  needsReview: Task[];
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

  constructor(options: LeadAgentOptions) {
    this.registry = options.registry;
    this.planner = options.planner;
    this.executor = options.executor;
    this.scheduler = new Scheduler({ concurrency: options.concurrency });
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

    try {
      const result = await this.executor.execute(task, agent, graph);
      graph.recordOutcome(task.id, {
        artifacts: result.artifacts,
        result: { summary: result.summary, filesChanged: result.filesChanged },
        errors: result.errors,
      });
      graph.setStatus(task.id, result.success ? 'completed' : 'failed');
    } catch (error) {
      graph.recordOutcome(task.id, {
        errors: [error instanceof Error ? error.message : String(error)],
      });
      graph.setStatus(task.id, 'failed');
    }
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
