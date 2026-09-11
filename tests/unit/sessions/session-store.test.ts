import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, SessionStore } from '@crewforge/core';
import type { SessionSummary } from '@crewforge/core';

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    runId: 'run-1',
    request: 'Add feature',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
    durationMs: 300_000,
    agentCounts: { lead: 1, backend: 1 },
    filesChanged: ['src/index.ts'],
    tasksTotal: 2,
    tasksCompleted: 2,
    tasksFailed: 0,
    tasksNeedsReview: 0,
    ...overrides,
  };
}

describe('SessionStore', () => {
  let crewforgeDir: string;

  beforeEach(async () => {
    crewforgeDir = await mkdtemp(join(tmpdir(), 'crewforge-sessions-'));
  });

  afterEach(async () => {
    await rm(crewforgeDir, { recursive: true, force: true });
  });

  it('round-trips a session summary through save/load', async () => {
    const store = new SessionStore({ crewforgeDir });
    const summary = makeSummary();
    await store.save(summary);

    const loaded = await store.load('run-1');
    expect(loaded).toEqual(summary);
  });

  it('throws NotFoundError when loading an unknown run', async () => {
    const store = new SessionStore({ crewforgeDir });
    await expect(store.load('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns an empty list when no sessions directory exists', async () => {
    const store = new SessionStore({ crewforgeDir });
    expect(await store.list()).toEqual([]);
  });

  it('lists sessions most-recent-first and skips malformed entries', async () => {
    const store = new SessionStore({ crewforgeDir });
    await store.save(makeSummary({ runId: 'run-1', createdAt: '2026-01-01T00:00:00.000Z' }));
    await store.save(makeSummary({ runId: 'run-2', createdAt: '2026-01-02T00:00:00.000Z' }));

    await mkdir(join(crewforgeDir, 'sessions', 'run-broken'), { recursive: true });
    await writeFile(
      join(crewforgeDir, 'sessions', 'run-broken', 'summary.json'),
      'not json',
      'utf8',
    );

    const sessions = await store.list();
    expect(sessions.map((s) => s.runId)).toEqual(['run-2', 'run-1']);
  });
});
