import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, readJsonFile, writeJsonFile } from '../shared/fs-utils.js';
import { TaskGraph } from './task-graph.js';
import type { Task } from './types.js';

export interface TaskStoreOptions {
  /** Root of the `.crewforge` directory. */
  crewforgeDir: string;
}

interface PersistedRun {
  runId: string;
  request: string;
  createdAt: string;
  tasks: Task[];
}

export interface LoadedRun {
  request: string;
  createdAt: string;
  graph: TaskGraph;
}

/** Persists the live task graph for a run to `.crewforge/tasks/current/<runId>.json`. */
export class TaskStore {
  private readonly crewforgeDir: string;

  constructor(options: TaskStoreOptions) {
    this.crewforgeDir = options.crewforgeDir;
  }

  async save(runId: string, request: string, graph: TaskGraph, createdAt?: string): Promise<void> {
    const persisted: PersistedRun = {
      runId,
      request,
      createdAt: createdAt ?? new Date().toISOString(),
      tasks: graph.listTasks(),
    };
    await writeJsonFile(this.path(runId), persisted);
  }

  async load(runId: string): Promise<LoadedRun> {
    const persisted = await readJsonFile<PersistedRun>(this.path(runId));
    return {
      request: persisted.request,
      createdAt: persisted.createdAt,
      graph: TaskGraph.fromTasks(persisted.tasks),
    };
  }

  async exists(runId: string): Promise<boolean> {
    return pathExists(this.path(runId));
  }

  /** Lists persisted run ids under `.crewforge/tasks/current/` (no ordering guarantee). */
  async listRunIds(): Promise<string[]> {
    const dir = join(this.crewforgeDir, 'tasks', 'current');
    if (!(await pathExists(dir))) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/, ''));
  }

  private path(runId: string): string {
    return join(this.crewforgeDir, 'tasks', 'current', `${runId}.json`);
  }
}
