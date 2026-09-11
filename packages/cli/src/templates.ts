import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolves the installed location of `@crewforge/templates` without importing any code from it. */
export function getTemplatesRoot(): string {
  const packageJsonUrl = import.meta.resolve('@crewforge/templates/package.json');
  return dirname(fileURLToPath(packageJsonUrl));
}

export function getBuiltinAgentsDir(): string {
  return join(getTemplatesRoot(), 'agents');
}

export function getBuiltinWorkflowsDir(): string {
  return join(getTemplatesRoot(), 'workflows');
}
