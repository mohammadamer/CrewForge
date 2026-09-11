import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTask, DefaultContextBuilder, loadAgentDefinition } from '@crewforge/core';
import type { RepositorySummary } from '@crewforge/core';

const fixturesDir = fileURLToPath(new URL('../../fixtures/valid-crewforge', import.meta.url));

const repository: RepositorySummary = {
  rootPath: '/repo',
  hasTests: true,
  hasLint: true,
  hasBuild: true,
  entryPoints: [],
  structure: [],
};

describe('DefaultContextBuilder', () => {
  it('loads knowledge files referenced by the agent definition', async () => {
    const agent = await loadAgentDefinition(`${fixturesDir}/agents/lead.md`);
    const task = createTask({ title: 'Plan feature', description: 'Plan the feature' });
    const builder = new DefaultContextBuilder();

    const context = await builder.build(task, agent, repository, { request: 'Add feature X' });

    expect(context.request).toBe('Add feature X');
    expect(context.task).toBe(task);
    expect(context.agentDefinition).toBe(agent);
    expect(context.relevantKnowledge).toEqual([
      { path: '../knowledge/architecture.md', content: expect.stringContaining('Architecture') },
    ]);
    expect(context.relevantFiles).toEqual([]);
    expect(context.priorDecisions).toEqual([]);
    expect(context.dependentResults).toEqual([]);
    expect(context.relevantDiff).toBeUndefined();
  });

  it('passes through dependentResults and priorDecisions when provided', async () => {
    const agent = await loadAgentDefinition(`${fixturesDir}/agents/backend.md`);
    const task = createTask({ title: 'Implement API', description: 'Implement the API' });
    const builder = new DefaultContextBuilder();

    const context = await builder.build(task, agent, repository, {
      request: 'Add feature X',
      dependentResults: [{ taskId: 'task-arch', summary: 'Architecture decided' }],
      priorDecisions: [{ id: 'ADR-001', title: 'Use Postgres', summary: 'Chose Postgres' }],
    });

    expect(context.dependentResults).toEqual([
      { taskId: 'task-arch', summary: 'Architecture decided' },
    ]);
    expect(context.priorDecisions).toEqual([
      { id: 'ADR-001', title: 'Use Postgres', summary: 'Chose Postgres' },
    ]);
  });
});
