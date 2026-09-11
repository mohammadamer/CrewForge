import { describe, expect, it } from 'vitest';
import { createTask, detectConflicts, TaskGraph } from '@crewforge/core';
import type { Task } from '@crewforge/core';

function completedTask(overrides: Partial<Task> & { filesChanged: string[] }): Task {
  const task = createTask({ title: overrides.title ?? 'task', description: 'd', owner: 'backend' });
  return {
    ...task,
    ...overrides,
    status: overrides.status ?? 'completed',
    result: { summary: 'done', filesChanged: overrides.filesChanged },
  };
}

describe('detectConflicts', () => {
  it('returns no conflicts when tasks touch disjoint files', () => {
    const tasks = [
      completedTask({ filesChanged: ['a.ts'] }),
      completedTask({ filesChanged: ['b.ts'] }),
    ];
    expect(detectConflicts(tasks)).toEqual([]);
  });

  it('flags a file touched by more than one completed task', () => {
    const a = completedTask({ filesChanged: ['shared.ts'] });
    const b = completedTask({ filesChanged: ['shared.ts', 'b.ts'] });

    const conflicts = detectConflicts([a, b]);

    expect(conflicts).toEqual([{ file: 'shared.ts', taskIds: [a.id, b.id] }]);
  });

  it('ignores failed/pending tasks when detecting overlap', () => {
    const a = completedTask({ filesChanged: ['shared.ts'] });
    const b = completedTask({ filesChanged: ['shared.ts'], status: 'failed' });

    expect(detectConflicts([a, b])).toEqual([]);
  });

  it('integrates with a real TaskGraph after execution', () => {
    const graph = new TaskGraph();
    const a = createTask({ title: 'a', description: 'd', owner: 'backend' });
    const b = createTask({ title: 'b', description: 'd', owner: 'frontend' });
    graph.addTask(a);
    graph.addTask(b);
    graph.setStatus(a.id, 'running');
    graph.recordOutcome(a.id, { result: { summary: 'done', filesChanged: ['shared.ts'] } });
    graph.setStatus(a.id, 'completed');
    graph.setStatus(b.id, 'running');
    graph.recordOutcome(b.id, { result: { summary: 'done', filesChanged: ['shared.ts'] } });
    graph.setStatus(b.id, 'completed');

    expect(detectConflicts(graph.listTasks())).toEqual([
      { file: 'shared.ts', taskIds: [a.id, b.id] },
    ]);
  });
});
