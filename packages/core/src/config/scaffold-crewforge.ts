import { join } from 'node:path';
import { stringify } from 'yaml';
import { CrewForgeError } from '../shared/errors.js';
import { atomicWriteFile, ensureDir, pathExists } from '../shared/fs-utils.js';
import type { RepositorySummary } from '../context/types.js';
import { detectRepository } from './detect-repository.js';

export interface AgentTemplateFile {
  role: string;
  fileName: string;
  content: string;
}

export interface ScaffoldCrewForgeOptions {
  repoRoot: string;
  teamName: string;
  agentTemplates: AgentTemplateFile[];
  /** Overwrite an existing `.crewforge/team.yaml` instead of erroring. */
  force?: boolean;
}

export interface ScaffoldCrewForgeResult {
  crewforgeDir: string;
  repository: RepositorySummary;
  createdFiles: string[];
}

const ARCHITECTURE_KNOWLEDGE_TEMPLATE =
  "# Architecture\n\n_Document your system's architecture here. Agents consult this file before proposing changes._\n";
const CONVENTIONS_KNOWLEDGE_TEMPLATE =
  '# Conventions\n\n_Document coding conventions, naming, and style guidance here._\n';

/**
 * Scaffolds `.crewforge/` for a repository: `team.yaml`, agent definitions, starter
 * knowledge files (including an auto-generated repository summary), and the empty
 * `decisions/`, `tasks/current/`, and `sessions/` directories.
 */
export async function scaffoldCrewForge(
  options: ScaffoldCrewForgeOptions,
): Promise<ScaffoldCrewForgeResult> {
  const crewforgeDir = join(options.repoRoot, '.crewforge');

  if (!options.force && (await pathExists(join(crewforgeDir, 'team.yaml')))) {
    throw new CrewForgeError(
      `${crewforgeDir} already contains a team.yaml. Re-run with force to reinitialize.`,
    );
  }

  const repository = await detectRepository(options.repoRoot);
  const createdFiles: string[] = [];

  const write = async (relativePath: string, content: string): Promise<void> => {
    await atomicWriteFile(join(crewforgeDir, relativePath), content);
    createdFiles.push(relativePath);
  };

  await write(
    'team.yaml',
    stringify(buildTeamConfigInput(options.teamName, options.agentTemplates, repository)),
  );

  for (const template of options.agentTemplates) {
    await write(join('agents', template.fileName), template.content);
  }

  await write(join('knowledge', 'architecture.md'), ARCHITECTURE_KNOWLEDGE_TEMPLATE);
  await write(join('knowledge', 'conventions.md'), CONVENTIONS_KNOWLEDGE_TEMPLATE);
  await write(join('knowledge', 'repository.md'), renderRepositoryKnowledge(repository));

  await ensureDir(join(crewforgeDir, 'decisions', 'archive'));
  await ensureDir(join(crewforgeDir, 'tasks', 'current'));
  await ensureDir(join(crewforgeDir, 'sessions'));

  return { crewforgeDir, repository, createdFiles };
}

function buildTeamConfigInput(
  teamName: string,
  agentTemplates: AgentTemplateFile[],
  repository: RepositorySummary,
): unknown {
  return {
    name: teamName,
    lead: 'lead',
    agents: agentTemplates.map((template) => template.role),
    workflow: {
      planning: true,
      parallel_execution: true,
      verification: true,
      human_approval: true,
      worktrees: false,
    },
    verification: {
      ...(repository.hasTests ? { test: 'npm test' } : {}),
      ...(repository.hasLint ? { lint: 'npm run lint' } : {}),
      ...(repository.hasBuild ? { build: 'npm run build' } : {}),
    },
    permissions: {
      shell: 'restricted',
      network: 'restricted',
      filesystem: 'repository',
      deployment: 'approval-required',
    },
  };
}

function renderRepositoryKnowledge(repository: RepositorySummary): string {
  const lines = [
    '# Repository',
    '',
    `- Language: ${repository.language ?? 'unknown'}`,
    `- Package manager: ${repository.packageManager ?? 'unknown'}`,
    `- Has tests: ${repository.hasTests}`,
    `- Has lint: ${repository.hasLint}`,
    `- Has build: ${repository.hasBuild}`,
    '',
    '## Top-level structure',
    '',
    ...repository.structure.map((entry) => `- ${entry}`),
  ];
  return `${lines.join('\n')}\n`;
}
