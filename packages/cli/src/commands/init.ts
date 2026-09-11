import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { scaffoldCrewForge } from '@crewforge/core';
import type { AgentTemplateFile, ScaffoldCrewForgeResult } from '@crewforge/core';
import { getBuiltinAgentsDir } from '../templates.js';

/** Matches build.md's MVP scope: Lead + Backend + Frontend + QA activated by default. */
const MVP_ROLES = ['lead', 'backend', 'frontend', 'qa'];

export interface InitOptions {
  cwd: string;
  name?: string;
  force?: boolean;
}

export async function runInit(options: InitOptions): Promise<ScaffoldCrewForgeResult> {
  const agentsDir = getBuiltinAgentsDir();
  const agentTemplates: AgentTemplateFile[] = await Promise.all(
    MVP_ROLES.map(async (role) => ({
      role,
      fileName: `${role}.md`,
      content: await readFile(join(agentsDir, `${role}.md`), 'utf8'),
    })),
  );

  return scaffoldCrewForge({
    repoRoot: options.cwd,
    teamName: options.name ?? basename(options.cwd),
    agentTemplates,
    force: options.force,
  });
}
