import { generatePrefixedId } from '../shared/id.js';
import type { Task } from './types.js';

export interface CreateTaskInput {
  title: string;
  description: string;
  owner?: string;
  dependencies?: string[];
}

/** Constructs a new `Task` in the initial `pending` status. */
export function createTask(input: CreateTaskInput): Task {
  return {
    id: generatePrefixedId('task'),
    title: input.title,
    description: input.description,
    owner: input.owner,
    dependencies: input.dependencies ?? [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    artifacts: [],
    errors: [],
  };
}
