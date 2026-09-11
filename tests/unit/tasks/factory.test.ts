import { describe, expect, it } from 'vitest';
import { createTask } from '@crewforge/core';

describe('createTask', () => {
  it('creates a pending task with sensible defaults', () => {
    const task = createTask({ title: 'Add auth', description: 'Add passwordless auth' });

    expect(task.status).toBe('pending');
    expect(task.title).toBe('Add auth');
    expect(task.dependencies).toEqual([]);
    expect(task.artifacts).toEqual([]);
    expect(task.errors).toEqual([]);
    expect(task.owner).toBeUndefined();
    expect(task.id.startsWith('task-')).toBe(true);
  });

  it('accepts an owner and dependencies', () => {
    const task = createTask({
      title: 'Implement API',
      description: 'Backend API for profiles',
      owner: 'backend',
      dependencies: ['task-aaaaaaaa'],
    });

    expect(task.owner).toBe('backend');
    expect(task.dependencies).toEqual(['task-aaaaaaaa']);
  });
});
