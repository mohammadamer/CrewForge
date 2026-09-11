import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AgentRegistry, DeterministicTaskPlanner, executeRun } from '@crewforge/core';
import type {
  AgentDefinition,
  AgentExecutor,
  AgentResult,
  RepositorySummary,
  Task,
  VerificationRunner,
  VerificationSummary,
} from '@crewforge/core';

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

class FakeExecutor implements AgentExecutor {
  constructor(private readonly filesByRole: Record<string, string[]> = {}) {}

  execute(task: Task, agent: AgentDefinition): Promise<AgentResult> {
    return Promise.resolve({
      success: true,
      summary: `${agent.role} done`,
      filesChanged: this.filesByRole[agent.role] ?? [`${agent.role}.ts`],
      artifacts: [],
      errors: [],
    });
  }
}

class FakeVerificationRunner implements VerificationRunner {
  constructor(private readonly summary: VerificationSummary) {}
  run(): Promise<VerificationSummary> {
    return Promise.resolve(this.summary);
  }
}

async function buildRegistry(): Promise<AgentRegistry> {
  const registry = new AgentRegistry({ agentsDir: fullTeamAgentsDir });
  await registry.load();
  return registry;
}

describe('executeRun', () => {
  it('returns no conflicts and no verification summary when neither applies', async () => {
    const registry = await buildRegistry();
    const summary = await executeRun('Add a feature', repository, {
      registry,
      planner: new DeterministicTaskPlanner(),
      executor: new FakeExecutor(),
    });

    expect(summary.conflicts).toEqual([]);
    expect(summary.verification).toBeUndefined();
    expect(summary.failed).toEqual([]);
  });

  it('demotes tasks with overlapping files to needs-review and records the conflict', async () => {
    const registry = await buildRegistry();
    const executor = new FakeExecutor({ backend: ['shared.ts'], frontend: ['shared.ts'] });

    const summary = await executeRun('Add a feature', repository, {
      registry,
      planner: new DeterministicTaskPlanner(),
      executor,
      resolveConflict: async (conflict) => `Merge changes to ${conflict.file} manually`,
    });

    expect(summary.conflicts).toHaveLength(1);
    expect(summary.conflicts[0]?.file).toBe('shared.ts');
    expect(summary.conflicts[0]?.suggestedResolution).toBe('Merge changes to shared.ts manually');

    const backendTask = summary.graph.listTasks().find((t) => t.owner === 'backend');
    expect(backendTask?.status).toBe('needs-review');
    expect(summary.needsReview.map((t) => t.id)).toContain(backendTask?.id);
  });

  it('demotes every completed task to needs-review when verification fails', async () => {
    const registry = await buildRegistry();
    const failingVerification: VerificationSummary = {
      passed: false,
      results: [
        {
          name: 'test',
          command: 'npm test',
          passed: false,
          exitCode: 1,
          stdout: '',
          stderr: 'test failed',
          durationMs: 5,
        },
      ],
    };

    const summary = await executeRun('Add a feature', repository, {
      registry,
      planner: new DeterministicTaskPlanner(),
      executor: new FakeExecutor(),
      verification: {
        enabled: true,
        config: { test: 'npm test' },
        runner: new FakeVerificationRunner(failingVerification),
      },
    });

    expect(summary.verification?.passed).toBe(false);
    expect(summary.completed).toEqual([]);
    expect(summary.needsReview.length).toBeGreaterThan(0);
  });

  it('skips the verification stage when no commands are configured', async () => {
    const registry = await buildRegistry();
    const summary = await executeRun('Add a feature', repository, {
      registry,
      planner: new DeterministicTaskPlanner(),
      executor: new FakeExecutor(),
      verification: {
        enabled: true,
        config: {},
        runner: new FakeVerificationRunner({ passed: true, results: [] }),
      },
    });

    expect(summary.verification).toBeUndefined();
  });

  it('skips the verification stage entirely when disabled', async () => {
    const registry = await buildRegistry();
    const failingVerification: VerificationSummary = { passed: false, results: [] };

    const summary = await executeRun('Add a feature', repository, {
      registry,
      planner: new DeterministicTaskPlanner(),
      executor: new FakeExecutor(),
      verification: {
        enabled: false,
        config: { test: 'npm test' },
        runner: new FakeVerificationRunner(failingVerification),
      },
    });

    expect(summary.verification).toBeUndefined();
    expect(summary.completed.length).toBeGreaterThan(0);
  });
});
