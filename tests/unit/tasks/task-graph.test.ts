import { describe, expect, it } from 'vitest';
import { createTask, TaskGraph, ValidationError } from '@crewforge/core';

function buildDiamond() {
  const graph = new TaskGraph();
  const a = createTask({ title: 'A', description: 'a' });
  graph.addTask(a);
  const b = createTask({ title: 'B', description: 'b', dependencies: [a.id] });
  graph.addTask(b);
  const c = createTask({ title: 'C', description: 'c', dependencies: [a.id] });
  graph.addTask(c);
  const d = createTask({ title: 'D', description: 'd', dependencies: [b.id, c.id] });
  graph.addTask(d);
  return { graph, a, b, c, d };
}

describe('TaskGraph', () => {
  it('rejects a task depending on an unknown task id', () => {
    const graph = new TaskGraph();
    const task = createTask({ title: 'X', description: 'x', dependencies: ['missing'] });
    expect(() => graph.addTask(task)).toThrow(ValidationError);
  });

  it('detects cycles when rehydrating via fromTasks', () => {
    const a = createTask({ title: 'A', description: 'a' });
    const b = createTask({ title: 'B', description: 'b', dependencies: [a.id] });
    a.dependencies.push(b.id); // force a <-> b cycle
    expect(() => TaskGraph.fromTasks([a, b])).toThrow(ValidationError);
  });

  it('computes ready tasks for a diamond dependency shape', () => {
    const { graph, a, b, c, d } = buildDiamond();

    expect(graph.getReadyTasks().map((t) => t.id)).toEqual([a.id]);

    graph.setStatus(a.id, 'running');
    graph.setStatus(a.id, 'completed');
    expect(
      graph
        .getReadyTasks()
        .map((t) => t.id)
        .sort(),
    ).toEqual([b.id, c.id].sort());

    graph.setStatus(b.id, 'running');
    graph.setStatus(b.id, 'completed');
    expect(graph.getReadyTasks().map((t) => t.id)).toEqual([c.id]);

    graph.setStatus(c.id, 'running');
    graph.setStatus(c.id, 'completed');
    expect(graph.getReadyTasks().map((t) => t.id)).toEqual([d.id]);
  });

  it('computes ready tasks for independent (disjoint) tasks', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    const b = createTask({ title: 'B', description: 'b' });
    graph.addTask(a);
    graph.addTask(b);
    expect(
      graph
        .getReadyTasks()
        .map((t) => t.id)
        .sort(),
    ).toEqual([a.id, b.id].sort());
  });

  it('computes ready tasks for a linear chain', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);
    const b = createTask({ title: 'B', description: 'b', dependencies: [a.id] });
    graph.addTask(b);
    const c = createTask({ title: 'C', description: 'c', dependencies: [b.id] });
    graph.addTask(c);

    expect(graph.getReadyTasks().map((t) => t.id)).toEqual([a.id]);
    graph.setStatus(a.id, 'running');
    graph.setStatus(a.id, 'completed');
    expect(graph.getReadyTasks().map((t) => t.id)).toEqual([b.id]);
  });

  it('enforces the task status transition state machine', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);

    expect(() => graph.setStatus(a.id, 'completed')).toThrow(ValidationError);

    graph.setStatus(a.id, 'running');
    expect(a.startedAt).toBeDefined();
    graph.setStatus(a.id, 'completed');
    expect(a.completedAt).toBeDefined();

    expect(() => graph.setStatus(a.id, 'running')).toThrow(ValidationError);
  });

  it('records outcome fields via recordOutcome', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);

    graph.recordOutcome(a.id, {
      artifacts: [{ path: 'src/index.ts' }],
      result: { summary: 'done', filesChanged: ['src/index.ts'] },
      errors: ['warning: something'],
    });

    const task = graph.getTask(a.id);
    expect(task.artifacts).toEqual([{ path: 'src/index.ts' }]);
    expect(task.result).toEqual({ summary: 'done', filesChanged: ['src/index.ts'] });
    expect(task.errors).toEqual(['warning: something']);
  });

  it('round-trips through fromTasks/listTasks', () => {
    const { graph } = buildDiamond();
    const rehydrated = TaskGraph.fromTasks(graph.listTasks());
    expect(rehydrated.listTasks()).toHaveLength(4);
  });

  it('reports isComplete only once every task reaches a terminal status', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'A', description: 'a' });
    graph.addTask(a);
    expect(graph.isComplete()).toBe(false);
    graph.setStatus(a.id, 'running');
    graph.setStatus(a.id, 'completed');
    expect(graph.isComplete()).toBe(true);
  });
});
