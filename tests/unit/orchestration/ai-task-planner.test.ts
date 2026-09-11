import { describe, expect, it } from 'vitest';
import { AiTaskPlanner, DefaultContextBuilder, EventBus } from '@crewforge/core';
import type { AgentDefinition, AgentRuntime, RepositorySummary } from '@crewforge/core';

const repository: RepositorySummary = {
  rootPath: '/repo',
  hasTests: true,
  hasLint: true,
  hasBuild: true,
  entryPoints: [],
  structure: [],
};

const leadAgent: AgentDefinition = {
  role: 'lead',
  displayName: 'Lead',
  responsibilities: ['Coordinate'],
  constraints: ['Do not implement directly'],
  knowledge: [],
  instructions: 'You are the Lead.',
  sourcePath: '/virtual/lead.md',
};

function runtimeReturning(summary: string): AgentRuntime {
  return {
    run: () =>
      Promise.resolve({ success: true, summary, filesChanged: [], artifacts: [], errors: [] }),

    stream: async function* () {},
  };
}

describe('AiTaskPlanner', () => {
  it('materializes tasks from a valid JSON plan, resolving key-based dependencies', async () => {
    const plan = {
      tasks: [
        { key: 'plan', title: 'Plan', description: 'Plan it', owner: 'lead', dependsOn: [] },
        {
          key: 'be',
          title: 'Implement backend',
          description: 'do backend',
          owner: 'backend',
          dependsOn: ['plan'],
        },
        { key: 'qa', title: 'Verify', description: 'verify', owner: 'qa', dependsOn: ['be'] },
      ],
    };
    const runtime = runtimeReturning('```json\n' + JSON.stringify(plan) + '\n```');
    const planner = new AiTaskPlanner({
      runtime,
      leadAgent,
      contextBuilder: new DefaultContextBuilder(),
    });

    const tasks = await planner.plan('Add auth', repository, ['lead', 'backend', 'qa']);

    expect(tasks).toHaveLength(3);
    const [planTask, backendTask, qaTask] = tasks;
    expect(planTask?.owner).toBe('lead');
    expect(backendTask?.dependencies).toEqual([planTask?.id]);
    expect(qaTask?.dependencies).toEqual([backendTask?.id]);
  });

  it('drops an owner that is not in availableRoles', async () => {
    const plan = {
      tasks: [{ key: 'x', title: 'X', description: 'x', owner: 'security', dependsOn: [] }],
    };
    const runtime = runtimeReturning(JSON.stringify(plan));
    const planner = new AiTaskPlanner({
      runtime,
      leadAgent,
      contextBuilder: new DefaultContextBuilder(),
    });

    const tasks = await planner.plan('Add auth', repository, ['lead']);
    expect(tasks[0]?.owner).toBeUndefined();
  });

  it('falls back to the deterministic planner when the response is not valid JSON', async () => {
    const runtime = runtimeReturning('not json at all');
    const planner = new AiTaskPlanner({
      runtime,
      leadAgent,
      contextBuilder: new DefaultContextBuilder(),
    });

    const tasks = await planner.plan('Add auth', repository, ['lead', 'backend', 'frontend', 'qa']);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]?.title).toBe('Plan implementation approach');
  });

  it('falls back to the deterministic planner when the runtime throws', async () => {
    const runtime: AgentRuntime = {
      run: () => Promise.reject(new Error('boom')),

      stream: async function* () {},
    };
    const planner = new AiTaskPlanner({
      runtime,
      leadAgent,
      contextBuilder: new DefaultContextBuilder(),
    });

    const tasks = await planner.plan('Add auth', repository, ['lead', 'backend']);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('emits an agent-message event when falling back', async () => {
    const runtime = runtimeReturning('not json');
    const eventBus = new EventBus();
    const planner = new AiTaskPlanner({
      runtime,
      leadAgent,
      contextBuilder: new DefaultContextBuilder(),
      eventBus,
    });

    await planner.plan('Add auth', repository, ['lead']);

    expect(eventBus.getHistory().map((event) => event.type)).toContain('agent-message');
  });
});
