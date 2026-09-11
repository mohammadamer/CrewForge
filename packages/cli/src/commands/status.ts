import { TaskStore } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

export interface StatusTask {
  id: string;
  title: string;
  owner?: string;
  status: string;
}

export interface StatusResult {
  runId: string;
  request: string;
  createdAt: string;
  tasks: StatusTask[];
}

/** Shows the most recently created run's task graph (there is no daemon, so this is the last `crewforge run`). */
export async function runStatus(cwd: string): Promise<StatusResult | undefined> {
  const store = new TaskStore({ crewforgeDir: crewforgeDirFor(cwd) });
  const runIds = await store.listRunIds();
  if (runIds.length === 0) return undefined;

  const loaded = await Promise.all(runIds.map((id) => store.load(id)));

  let latestIndex = 0;
  for (let i = 1; i < loaded.length; i += 1) {
    const candidate = loaded[i];
    const current = loaded[latestIndex];
    if (candidate && current && candidate.createdAt > current.createdAt) {
      latestIndex = i;
    }
  }

  const latest = loaded[latestIndex];
  const runId = runIds[latestIndex];
  if (!latest || !runId) return undefined;

  return {
    runId,
    request: latest.request,
    createdAt: latest.createdAt,
    tasks: latest.graph.listTasks().map((task) => ({
      id: task.id,
      title: task.title,
      owner: task.owner,
      status: task.status,
    })),
  };
}
