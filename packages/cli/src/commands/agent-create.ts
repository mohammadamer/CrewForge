import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWriteFile, CrewForgeError, pathExists } from '@crewforge/core';
import { agentsDirFor } from '../paths.js';
import { getBuiltinAgentsDir } from '../templates.js';

export interface AgentCreateOptions {
  cwd: string;
  role: string;
  force?: boolean;
}

/** Scaffolds `.crewforge/agents/<role>.md` from a built-in template, or a blank one. */
export async function runAgentCreate(options: AgentCreateOptions): Promise<string> {
  const targetPath = join(agentsDirFor(options.cwd), `${options.role}.md`);
  if (!options.force && (await pathExists(targetPath))) {
    throw new CrewForgeError(`Agent "${options.role}" already exists at ${targetPath}`);
  }

  const builtinPath = join(getBuiltinAgentsDir(), `${options.role}.md`);
  const content = (await pathExists(builtinPath))
    ? await readFile(builtinPath, 'utf8')
    : blankAgentTemplate(options.role);

  await atomicWriteFile(targetPath, content);
  return targetPath;
}

function blankAgentTemplate(role: string): string {
  return [
    '---',
    `role: ${role}`,
    'responsibilities:',
    '  - TODO',
    'constraints:',
    '  - TODO',
    'knowledge: []',
    '---',
    '',
    `# ${role}`,
    '',
    "Describe this agent's instructions here.",
    '',
  ].join('\n');
}
