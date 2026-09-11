import { join } from 'node:path';

export function crewforgeDirFor(cwd: string): string {
  return join(cwd, '.crewforge');
}

export function agentsDirFor(cwd: string): string {
  return join(crewforgeDirFor(cwd), 'agents');
}
