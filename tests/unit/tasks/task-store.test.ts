import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, TaskGraph, TaskStore } from '@crewforge/core';

describe('TaskStore', () => {
  let crewforgeDir: string;

  beforeEach(async () => {
    crewforgeDir = await mkdtemp(join(tmpdir(), 'crewforge-task-store-'));
  });

  afterEach(async () => {
    await rm(crewforgeDir, { recursive: true, force: true });
  });

  it('round-trips a task graph through save/load', async () => {
    const store = new TaskStore({ crewforgeDir });
    const graph = new TaskGraph();
    const task = createTask({ title: 'Add auth', description: 'Add passwordless auth' });
    graph.addTask(task);
    graph.setStatus(task.id, 'running');
    graph.setStatus(task.id, 'completed');

    await store.save('run-1', 'Add auth', graph);
    expect(await store.exists('run-1')).toBe(true);

    const loaded = await store.load('run-1');
    expect(loaded.request).toBe('Add auth');
    expect(loaded.graph.getTask(task.id).status).toBe('completed');
  });

  it('reports exists() as false for a run that was never saved', async () => {
    const store = new TaskStore({ crewforgeDir });
    expect(await store.exists('nonexistent')).toBe(false);
  });
});
