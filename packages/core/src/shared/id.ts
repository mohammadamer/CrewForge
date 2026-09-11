import { randomUUID } from 'node:crypto';

/** Generates a unique identifier (task ids, run ids, event ids, ...). */
export function generateId(): string {
  return randomUUID();
}

/** Generates a short, human-scannable identifier such as `run-3f9a1c2b`. */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
