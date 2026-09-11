import type { TaskGraph } from '../tasks/task-graph.js';
import type { Task } from '../tasks/types.js';

export interface SchedulerOptions {
  /** Max number of tasks executed concurrently within a single ready batch. */
  concurrency?: number;
}

export type TaskExecutor = (task: Task) => Promise<void>;

const DEFAULT_CONCURRENCY = 4;

/**
 * Repeatedly takes all currently-ready tasks (bounded by `concurrency`), runs them
 * concurrently via `executor`, and loops until the graph has no more ready tasks.
 * Pure with respect to the graph's scheduling: the executor owns status transitions.
 */
export class Scheduler {
  private readonly concurrency: number;

  constructor(options: SchedulerOptions = {}) {
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  }

  async run(graph: TaskGraph, executor: TaskExecutor): Promise<void> {
    for (;;) {
      const ready = graph.getReadyTasks();
      if (ready.length === 0) break;
      const batch = ready.slice(0, this.concurrency);
      await Promise.all(batch.map((task) => executor(task)));
    }
  }
}
