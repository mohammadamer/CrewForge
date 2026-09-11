import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { loadTeamConfig, pathExists } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  healthy: boolean;
}

export async function runDoctor(cwd: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js >= 22',
    passed: nodeMajor >= 22,
    detail: `node ${process.version}`,
  });

  const gitAvailable = await commandAvailable('git', ['--version']);
  checks.push({
    name: 'git on PATH',
    passed: gitAvailable,
    detail: gitAvailable ? 'found' : 'not found \u2014 Git integration will not work',
  });

  const crewforgeDir = crewforgeDirFor(cwd);
  const initialized = await pathExists(join(crewforgeDir, 'team.yaml'));
  checks.push({
    name: '.crewforge initialized',
    passed: initialized,
    detail: initialized ? crewforgeDir : 'run `crewforge init` first',
  });

  if (initialized) {
    try {
      const teamConfig = await loadTeamConfig(crewforgeDir);
      checks.push({ name: 'team.yaml valid', passed: true, detail: 'schema OK' });

      if (teamConfig.workflow.worktrees) {
        const isGitRepo = await pathExists(join(cwd, '.git'));
        checks.push({
          name: 'git repository (required by workflow.worktrees)',
          passed: isGitRepo,
          detail: isGitRepo
            ? 'found'
            : 'not a git repository — run `git init` or disable workflow.worktrees',
        });
      }
    } catch (error) {
      checks.push({
        name: 'team.yaml valid',
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const hasCredentials = Boolean(process.env.CREWFORGE_MODEL_API_KEY ?? process.env.GITHUB_TOKEN);
  checks.push({
    name: 'AI runtime credentials',
    passed: true,
    detail: hasCredentials
      ? 'CopilotRuntime available (CREWFORGE_MODEL_API_KEY/GITHUB_TOKEN set)'
      : 'none set; MockRuntime will be used by default',
  });

  return { checks, healthy: checks.every((check) => check.passed) };
}

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}
