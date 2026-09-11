import { SessionStore } from '@crewforge/core';
import type { SessionSummary } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

export async function runHistory(cwd: string): Promise<SessionSummary[]> {
  const store = new SessionStore({ crewforgeDir: crewforgeDirFor(cwd) });
  return store.list();
}

export async function runHistoryDetail(cwd: string, runId: string): Promise<SessionSummary> {
  const store = new SessionStore({ crewforgeDir: crewforgeDirFor(cwd) });
  return store.load(runId);
}
