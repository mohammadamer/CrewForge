import { describe, expect, it } from 'vitest';
import { DeterministicTaskPlanner, TaskGraph } from '@crewforge/core';
import type { RepositorySummary } from '@crewforge/core';

const repository: RepositorySummary = {
  rootPath: '/repo',
  hasTests: true,
  hasLint: true,
  hasBuild: true,
  entryPoints: [],
  structure: [],
};

describe('DeterministicTaskPlanner', () => {
  it('produces plan -> {backend, frontend} -> qa when all roles are available', async () => {
    const planner = new DeterministicTaskPlanner();
    const tasks = await planner.plan('Add auth', repository, ['lead', 'backend', 'frontend', 'qa']);

    expect(tasks).toHaveLength(4);
    const [plan, backend, frontend, qa] = tasks;
    expect(plan?.owner).toBe('lead');
    expect(backend?.owner).toBe('backend');
    expect(backend?.dependencies).toEqual([plan?.id]);
    expect(frontend?.owner).toBe('frontend');
    expect(frontend?.dependencies).toEqual([plan?.id]);
    expect(qa?.owner).toBe('qa');
    expect(qa?.dependencies.slice().sort()).toEqual([backend?.id, frontend?.id].sort());
  });

  it('falls back to depending directly on the planning task with no implementation roles', async () => {
    const planner = new DeterministicTaskPlanner();
    const tasks = await planner.plan('Add auth', repository, ['lead', 'qa']);

    expect(tasks).toHaveLength(2);
    const [plan, qa] = tasks;
    expect(qa?.dependencies).toEqual([plan?.id]);
  });

  it('leaves the planning task unowned when no lead role is available', async () => {
    const planner = new DeterministicTaskPlanner();
    const tasks = await planner.plan('Add auth', repository, ['backend']);
    expect(tasks[0]?.owner).toBeUndefined();
  });

  it('produces tasks that can be added to a TaskGraph in the returned order', async () => {
    const planner = new DeterministicTaskPlanner();
    const tasks = await planner.plan('Add auth', repository, ['lead', 'backend', 'frontend', 'qa']);
    const graph = new TaskGraph();
    for (const task of tasks) graph.addTask(task);
    expect(graph.listTasks()).toHaveLength(4);
  });
});
