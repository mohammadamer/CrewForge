import { NotFoundError, ValidationError } from '../shared/errors.js';
import { isTerminalTaskStatus } from './types.js';
import type { Task, TaskArtifact, TaskResult, TaskStatus } from './types.js';

/** Valid forward transitions for a task's status (see build.md's task status list). */
const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['planning', 'ready', 'running', 'needs-review', 'blocked'],
  planning: ['ready', 'running', 'blocked'],
  ready: ['running', 'blocked'],
  running: ['completed', 'failed', 'needs-review', 'blocked'],
  blocked: ['pending', 'ready'],
  // A task can be demoted back to needs-review after the fact by conflict detection
  // or a failed verification run, even though it already finished successfully.
  completed: ['approved', 'needs-review'],
  failed: ['needs-review', 'ready'],
  'needs-review': ['approved', 'ready', 'failed'],
  approved: [],
};

/**
 * A dependency graph of `Task`s. Enforces acyclicity and the task status state
 * machine; computes which tasks are ready to run given current statuses.
 */
export class TaskGraph {
  private readonly tasks = new Map<string, Task>();

  addTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      throw new ValidationError(`Task with id "${task.id}" already exists in this graph`);
    }
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        throw new ValidationError(`Task "${task.id}" depends on unknown task "${depId}"`);
      }
    }
    this.tasks.set(task.id, task);
    this.assertAcyclic();
  }

  getTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) {
      throw new NotFoundError(`No task with id "${id}"`);
    }
    return task;
  }

  listTasks(): Task[] {
    return [...this.tasks.values()];
  }

  setStatus(id: string, status: TaskStatus): void {
    const task = this.getTask(id);
    const allowed = ALLOWED_TRANSITIONS[task.status];
    if (!allowed.includes(status)) {
      throw new ValidationError(
        `Cannot transition task "${id}" from "${task.status}" to "${status}"`,
      );
    }
    task.status = status;
    if (status === 'running' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }
    if (isTerminalTaskStatus(status) && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    }
  }

  /** Records execution outcome fields in one place rather than mutating a task ad hoc. */
  recordOutcome(
    id: string,
    outcome: { artifacts?: TaskArtifact[]; result?: TaskResult; errors?: string[] },
  ): void {
    const task = this.getTask(id);
    if (outcome.artifacts) task.artifacts = outcome.artifacts;
    if (outcome.result) task.result = outcome.result;
    if (outcome.errors?.length) task.errors.push(...outcome.errors);
  }

  /** Tasks whose dependencies are all completed/approved and which are themselves startable. */
  getReadyTasks(): Task[] {
    return this.listTasks().filter((task) => {
      if (task.status !== 'pending' && task.status !== 'ready') return false;
      return task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep !== undefined && (dep.status === 'completed' || dep.status === 'approved');
      });
    });
  }

  isComplete(): boolean {
    return this.listTasks().every((task) => isTerminalTaskStatus(task.status));
  }

  /** Rehydrates a graph from previously-persisted tasks, re-validating structure. */
  static fromTasks(tasks: Task[]): TaskGraph {
    const graph = new TaskGraph();
    for (const task of tasks) {
      graph.tasks.set(task.id, task);
    }
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!graph.tasks.has(depId)) {
          throw new ValidationError(`Task "${task.id}" depends on unknown task "${depId}"`);
        }
      }
    }
    graph.assertAcyclic();
    return graph;
  }

  private assertAcyclic(): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new ValidationError(`Task graph contains a dependency cycle involving "${id}"`);
      }
      visiting.add(id);
      const task = this.tasks.get(id);
      for (const depId of task?.dependencies ?? []) {
        visit(depId);
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const id of this.tasks.keys()) {
      visit(id);
    }
  }
}
