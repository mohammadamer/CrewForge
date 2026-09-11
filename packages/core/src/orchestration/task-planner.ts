import { createTask } from '../tasks/factory.js';
import type { Task } from '../tasks/types.js';
import type { RepositorySummary } from '../context/types.js';

const IMPLEMENTATION_ROLES = ['backend', 'frontend'] as const;

export interface TaskPlanner {
  /**
   * Returns a list of tasks in a valid topological order (each task's dependencies
   * appear earlier in the array) ready to be added to a `TaskGraph` in that order.
   */
  plan(request: string, repository: RepositorySummary, availableRoles: string[]): Promise<Task[]>;
}

/**
 * Deterministic placeholder planner used before a real AI-driven planner exists
 * (added once `@crewforge/runtime` lands). Always produces:
 * plan -> {backend, frontend} in parallel (whichever are available) -> qa.
 */
export class DeterministicTaskPlanner implements TaskPlanner {
  async plan(
    request: string,
    _repository: RepositorySummary,
    availableRoles: string[],
  ): Promise<Task[]> {
    const tasks: Task[] = [];

    const planningTask = createTask({
      title: 'Plan implementation approach',
      description: `Understand and break down the request: ${request}`,
      owner: availableRoles.includes('lead') ? 'lead' : undefined,
    });
    tasks.push(planningTask);

    const implementationTasks: Task[] = [];
    for (const role of IMPLEMENTATION_ROLES) {
      if (!availableRoles.includes(role)) continue;
      const task = createTask({
        title: `Implement ${role} changes`,
        description: request,
        owner: role,
        dependencies: [planningTask.id],
      });
      tasks.push(task);
      implementationTasks.push(task);
    }

    if (availableRoles.includes('qa')) {
      tasks.push(
        createTask({
          title: 'Verify implementation',
          description: `Verify: ${request}`,
          owner: 'qa',
          dependencies: implementationTasks.length
            ? implementationTasks.map((task) => task.id)
            : [planningTask.id],
        }),
      );
    }

    return Promise.resolve(tasks);
  }
}
