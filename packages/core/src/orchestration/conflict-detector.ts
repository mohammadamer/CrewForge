import type { Task } from '../tasks/types.js';

export interface ConflictGroup {
  file: string;
  taskIds: string[];
}

/**
 * Detects tasks whose reported `filesChanged` overlap. Overlap means two specialists
 * touched the same file independently — build.md requires halting auto-merge and
 * escalating rather than silently discarding either agent's work.
 */
export function detectConflicts(tasks: Task[]): ConflictGroup[] {
  const taskIdsByFile = new Map<string, string[]>();

  for (const task of tasks) {
    if (task.status !== 'completed' && task.status !== 'needs-review') continue;
    for (const file of task.result?.filesChanged ?? []) {
      const taskIds = taskIdsByFile.get(file) ?? [];
      taskIds.push(task.id);
      taskIdsByFile.set(file, taskIds);
    }
  }

  return [...taskIdsByFile.entries()]
    .filter(([, taskIds]) => taskIds.length > 1)
    .map(([file, taskIds]) => ({ file, taskIds }));
}
