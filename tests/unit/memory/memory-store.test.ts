import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '@crewforge/core';

describe('MemoryStore', () => {
  let crewforgeDir: string;

  beforeEach(async () => {
    crewforgeDir = await mkdtemp(join(tmpdir(), 'crewforge-memory-'));
  });

  afterEach(async () => {
    await rm(crewforgeDir, { recursive: true, force: true });
  });

  it('returns an empty list when no memory file exists yet', async () => {
    const store = new MemoryStore({ crewforgeDir });
    expect(await store.read('backend')).toEqual([]);
  });

  it('appends entries and reads them back in order', async () => {
    const store = new MemoryStore({ crewforgeDir });
    await store.append('backend', { timestamp: '2026-01-01T00:00:00.000Z', summary: 'first' });
    await store.append('backend', {
      timestamp: '2026-01-02T00:00:00.000Z',
      taskId: 'task-1',
      summary: 'second',
    });

    const entries = await store.read('backend');
    expect(entries).toEqual([
      { timestamp: '2026-01-01T00:00:00.000Z', taskId: undefined, summary: 'first' },
      { timestamp: '2026-01-02T00:00:00.000Z', taskId: 'task-1', summary: 'second' },
    ]);
  });

  it('drops the oldest entries once the rendered file exceeds maxChars', async () => {
    const store = new MemoryStore({ crewforgeDir, maxChars: 120 });
    for (let i = 0; i < 10; i += 1) {
      await store.append('backend', {
        timestamp: `2026-01-01T00:00:0${i}.000Z`,
        summary: `entry number ${i} with some padding text`,
      });
    }

    const entries = await store.read('backend');
    expect(entries.length).toBeLessThan(10);
    expect(entries.at(-1)?.summary).toContain('entry number 9');
  });

  it('scopes memory per agent role', async () => {
    const store = new MemoryStore({ crewforgeDir });
    await store.append('backend', {
      timestamp: '2026-01-01T00:00:00.000Z',
      summary: 'backend note',
    });
    await store.append('frontend', {
      timestamp: '2026-01-01T00:00:00.000Z',
      summary: 'frontend note',
    });

    expect(await store.read('backend')).toHaveLength(1);
    expect(await store.read('frontend')).toHaveLength(1);
    expect((await store.read('backend'))[0]?.summary).toBe('backend note');
  });
});
