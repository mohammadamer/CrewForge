import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AgentRegistry,
  DeterministicTaskPlanner,
  LeadAgent,
  LocalGitProvider,
  WorktreeCoordinator,
} from '@crewforge/core';
import type {
  AgentDefinition,
  AgentExecutionContext,
  AgentExecutor,
  AgentResult,
  RepositorySummary,
  Task,
} from '@crewforge/core';

const execFileAsync = promisify(execFile);

const fullTeamAgentsDir = fileURLToPath(
  new URL('../../fixtures/full-team/agents', import.meta.url),
);

const repository: RepositorySummary = {
  rootPath: '/repo',
  hasTests: true,
  hasLint: true,
  hasBuild: true,
  entryPoints: [],
  structure: [],
};

/** Writes a real file into the task's isolated worktree, standing in for a future
 *  tool-using agent — proves the isolation/merge pipeline works end to end, not just
 *  on self-reported file lists. */
class FileWritingExecutor implements AgentExecutor {
  constructor(private readonly writes: Record<string, { path: string; content: string }>) {}

  async execute(
    task: Task,
    agent: AgentDefinition,
    _graph: unknown,
    execContext?: AgentExecutionContext,
  ): Promise<AgentResult> {
    const write = agent.role in this.writes ? this.writes[agent.role] : undefined;
    if (write && execContext?.cwd) {
      await writeFile(join(execContext.cwd, write.path), write.content);
    }
    return {
      success: true,
      summary: `${agent.role} done: ${task.title}`,
      filesChanged: write ? [write.path] : [],
      artifacts: [],
      errors: [],
    };
  }
}

describe('LeadAgent worktree isolation', () => {
  let repoRoot: string;
  let worktrees: WorktreeCoordinator;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'crewforge-lead-wt-'));
    await git(repoRoot, ['init', '--initial-branch=main']);
    await git(repoRoot, ['config', 'user.email', 'test@example.com']);
    await git(repoRoot, ['config', 'user.name', 'Test']);
    await writeFile(join(repoRoot, 'README.md'), '# hello\n');
    await git(repoRoot, ['add', '-A']);
    await git(repoRoot, ['commit', '-m', 'initial commit']);

    worktrees = new WorktreeCoordinator({
      gitProvider: new LocalGitProvider({ cwd: repoRoot }),
      createGitProvider: (cwd) => new LocalGitProvider({ cwd }),
      worktreesDir: join(repoRoot, '.crewforge', 'worktrees'),
    });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('merges two parallel tasks that touch different files with no conflict', async () => {
    const registry = new AgentRegistry({ agentsDir: fullTeamAgentsDir });
    await registry.load();
    const executor = new FileWritingExecutor({
      backend: { path: 'backend.ts', content: '// backend\n' },
      frontend: { path: 'frontend.ts', content: '// frontend\n' },
    });
    const lead = new LeadAgent({
      registry,
      planner: new DeterministicTaskPlanner(),
      executor,
      worktrees,
    });

    const summary = await lead.run('Add health check endpoint', repository);

    expect(summary.worktreeConflicts).toEqual([]);
    expect(summary.failed).toHaveLength(0);
    expect(summary.needsReview).toHaveLength(0);
    await expect(readFile(join(repoRoot, 'backend.ts'), 'utf8')).resolves.toBe('// backend\n');
    await expect(readFile(join(repoRoot, 'frontend.ts'), 'utf8')).resolves.toBe('// frontend\n');
  });

  it('flags a real merge conflict between two parallel tasks as needs-review', async () => {
    const registry = new AgentRegistry({ agentsDir: fullTeamAgentsDir });
    await registry.load();
    const executor = new FileWritingExecutor({
      backend: { path: 'README.md', content: '# from backend\n' },
      frontend: { path: 'README.md', content: '# from frontend\n' },
    });
    const lead = new LeadAgent({
      registry,
      planner: new DeterministicTaskPlanner(),
      executor,
      worktrees,
    });

    const summary = await lead.run('Add health check endpoint', repository);

    expect(summary.worktreeConflicts).toHaveLength(1);
    const [conflict] = summary.worktreeConflicts;
    expect(['backend', 'frontend']).toContain(summary.graph.getTask(conflict.taskId).owner);

    // Exactly one of the two lands cleanly; the other is demoted to needs-review by the conflict.
    const backendTask = summary.graph.listTasks().find((task) => task.owner === 'backend')!;
    const frontendTask = summary.graph.listTasks().find((task) => task.owner === 'frontend')!;
    const statuses = [backendTask.status, frontendTask.status].sort();
    expect(statuses).toEqual(['completed', 'needs-review']);
  });
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}
