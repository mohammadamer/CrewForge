import { describe, expect, it } from 'vitest';
import { createTask, Scheduler, TaskGraph } from '@crewforge/core';

describe('Scheduler', () => {
  it('runs independent tasks concurrently up to the concurrency limit', async () => {
    const graph = new TaskGraph();
    for (const label of ['a', 'b', 'c']) {
      graph.addTask(createTask({ title: label, description: label }));
    }

    let concurrent = 0;
    let maxConcurrent = 0;
    const scheduler = new Scheduler({ concurrency: 2 });

    await scheduler.run(graph, async (task) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      graph.setStatus(task.id, 'running');
      await new Promise((resolve) => setTimeout(resolve, 5));
      graph.setStatus(task.id, 'completed');
      concurrent -= 1;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(graph.listTasks().every((task) => task.status === 'completed')).toBe(true);
  });

  it('unblocks dependents only after their dependencies complete', async () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);
    const b = createTask({ title: 'B', description: 'b', dependencies: [a.id] });
    graph.addTask(b);

    const order: string[] = [];
    const scheduler = new Scheduler();
    await scheduler.run(graph, (task) => {
      order.push(task.id);
      graph.setStatus(task.id, 'running');
      graph.setStatus(task.id, 'completed');
      return Promise.resolve();
    });

    expect(order).toEqual([a.id, b.id]);
  });

  it('leaves dependents pending (not run) when a dependency fails', async () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);
    const b = createTask({ title: 'B', description: 'b', dependencies: [a.id] });
    graph.addTask(b);

    const scheduler = new Scheduler();
    await scheduler.run(graph, (task) => {
      graph.setStatus(task.id, 'running');
      graph.setStatus(task.id, 'failed');
      return Promise.resolve();
    });

    expect(graph.getTask(a.id).status).toBe('failed');
    expect(graph.getTask(b.id).status).toBe('pending');
  });
});
