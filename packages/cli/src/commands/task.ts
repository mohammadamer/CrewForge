import { createTask, generatePrefixedId, TaskGraph, TaskStore } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

export interface TaskCreateOptions {
  cwd: string;
  title: string;
  description?: string;
}

export interface TaskCreateResult {
  runId: string;
  taskId: string;
}

/** Manually appends a single-task "run" for human-initiated backlog entries. */
export async function runTaskCreate(options: TaskCreateOptions): Promise<TaskCreateResult> {
  const store = new TaskStore({ crewforgeDir: crewforgeDirFor(options.cwd) });
  const task = createTask({
    title: options.title,
    description: options.description ?? options.title,
  });
  const graph = new TaskGraph();
  graph.addTask(task);

  const runId = generatePrefixedId('run');
  await store.save(runId, options.title, graph);
  return { runId, taskId: task.id };
}
