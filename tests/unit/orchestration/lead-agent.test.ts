import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AgentRegistry, DeterministicTaskPlanner, LeadAgent } from '@crewforge/core';
import type {
  AgentDefinition,
  AgentExecutor,
  AgentResult,
  RepositorySummary,
  Task,
} from '@crewforge/core';

const fullTeamAgentsDir = fileURLToPath(
  new URL('../../fixtures/full-team/agents', import.meta.url),
);
const backendOnlyAgentsDir = fileURLToPath(
  new URL('../../fixtures/backend-only/agents', import.meta.url),
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
  public readonly calls: Array<{ task: Task; agent: AgentDefinition }> = [];

  constructor(private readonly shouldFail: (task: Task) => boolean = () => false) {}

  execute(task: Task, agent: AgentDefinition): Promise<AgentResult> {
    this.calls.push({ task, agent });
    if (this.shouldFail(task)) {
      return Promise.resolve({
        success: false,
        summary: 'failed',
        filesChanged: [],
        artifacts: [],
        errors: ['boom'],
      });
    }
    return Promise.resolve({
      success: true,
      summary: `${agent.role} done: ${task.title}`,
      filesChanged: [`${agent.role}.ts`],
      artifacts: [],
      errors: [],
    });
  }
}

describe('LeadAgent', () => {
  it('plans, delegates in parallel, and completes a run end to end', async () => {
    const registry = new AgentRegistry({ agentsDir: fullTeamAgentsDir });
    await registry.load();
    const executor = new FakeExecutor();
    const lead = new LeadAgent({ registry, planner: new DeterministicTaskPlanner(), executor });

    const summary = await lead.run('Add health check endpoint', repository);

    expect(summary.failed).toHaveLength(0);
    expect(summary.needsReview).toHaveLength(0);
    expect(summary.completed).toHaveLength(4);
    expect(executor.calls.map((call) => call.agent.role).sort()).toEqual(
      ['lead', 'backend', 'frontend', 'qa'].sort(),
    );
  });

  it('marks a failing task failed and leaves its dependents blocked', async () => {
    const registry = new AgentRegistry({ agentsDir: fullTeamAgentsDir });
    await registry.load();
    const executor = new FakeExecutor((task) => task.owner === 'backend');
    const lead = new LeadAgent({ registry, planner: new DeterministicTaskPlanner(), executor });

    const summary = await lead.run('Add health check endpoint', repository);

    const backendTask = summary.graph.listTasks().find((task) => task.owner === 'backend');
    expect(backendTask?.status).toBe('failed');
    expect(backendTask?.errors).toContain('boom');

    const qaTask = summary.graph.listTasks().find((task) => task.owner === 'qa');
    expect(qaTask?.status).toBe('blocked');
  });

  it('surfaces an unassigned planning task as needs-review and blocks its dependents', async () => {
    const registry = new AgentRegistry({ agentsDir: backendOnlyAgentsDir });
    await registry.load();
    const executor = new FakeExecutor();
    const lead = new LeadAgent({ registry, planner: new DeterministicTaskPlanner(), executor });

    const summary = await lead.run('Add health check endpoint', repository);

    expect(summary.needsReview).toHaveLength(1);
    const backendTask = summary.graph.listTasks().find((task) => task.owner === 'backend');
    expect(backendTask?.status).toBe('blocked');
    expect(executor.calls).toHaveLength(0);
  });
});
