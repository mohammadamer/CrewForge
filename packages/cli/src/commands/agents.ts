import { AgentRegistry } from '@crewforge/core';
import type { AgentDefinition } from '@crewforge/core';
import { agentsDirFor } from '../paths.js';

export async function runAgents(cwd: string): Promise<AgentDefinition[]> {
  const registry = new AgentRegistry({ agentsDir: agentsDirFor(cwd) });
  await registry.load();
  return registry.list();
}
