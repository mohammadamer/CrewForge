import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTask,
  DefaultContextBuilder,
  EventBus,
  MemoryStore,
  RuntimeAgentExecutor,
  TaskGraph,
} from '@crewforge/core';
import type {
  AgentDefinition,
  AgentRequest,
  AgentResult,
  AgentRuntime,
  RepositorySummary,
} from '@crewforge/core';

const repository: RepositorySummary = {
  rootPath: '/repo',
  hasTests: true,
  hasLint: true,
  hasBuild: true,
  entryPoints: [],
  structure: [],
};

const backendAgent: AgentDefinition = {
  role: 'backend',
  displayName: 'Backend',
  responsibilities: ['Implement'],
  constraints: ['Do not touch frontend'],
  knowledge: [],
  instructions: 'You implement backend code.',
  sourcePath: '/virtual/backend.md',
};

class StubRuntime implements AgentRuntime {
  public lastRequest: AgentRequest | undefined;

  constructor(private readonly result: AgentResult) {}

  run(request: AgentRequest): Promise<AgentResult> {
    this.lastRequest = request;
    return Promise.resolve(this.result);
  }

  async *stream(): AsyncIterable<never> {
    // unused in these tests
  }
}

describe('RuntimeAgentExecutor', () => {
  let crewforgeDir: string;

  beforeEach(async () => {
    crewforgeDir = await mkdtemp(join(tmpdir(), 'crewforge-executor-'));
  });

  afterEach(async () => {
    await rm(crewforgeDir, { recursive: true, force: true });
  });

  it('builds context, calls the runtime, emits events, and records memory on success', async () => {
    const graph = new TaskGraph();
    const depTask = createTask({ title: 'Plan', description: 'plan it' });
    graph.addTask(depTask);
    graph.setStatus(depTask.id, 'running');
    graph.setStatus(depTask.id, 'completed');
    graph.recordOutcome(depTask.id, {
      result: { summary: 'Architecture decided', filesChanged: [] },
    });

    const task = createTask({
      title: 'Implement API',
      description: 'Implement it',
      owner: 'backend',
      dependencies: [depTask.id],
    });
    graph.addTask(task);
    graph.setStatus(task.id, 'running');

    const runtime = new StubRuntime({
      success: true,
      summary: 'Implemented the API',
      filesChanged: ['api.ts'],
      artifacts: [{ path: 'api.ts' }],
      errors: [],
    });
    const eventBus = new EventBus();
    const memoryStore = new MemoryStore({ crewforgeDir });

    const executor = new RuntimeAgentExecutor({
      runtime,
      contextBuilder: new DefaultContextBuilder(),
      repository,
      request: 'Add feature X',
      eventBus,
      memoryStore,
    });

    const result = await executor.execute(task, backendAgent, graph);

    expect(result.success).toBe(true);
    expect(runtime.lastRequest?.context.dependentResults).toEqual([
      { taskId: depTask.id, summary: 'Architecture decided' },
    ]);
    expect(runtime.lastRequest?.context.request).toBe('Add feature X');

    expect(eventBus.getHistory().map((event) => event.type)).toEqual([
      'agent-started',
      'agent-completed',
    ]);

    const memoryEntries = await memoryStore.read('backend');
    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0]?.summary).toBe('Implemented the API');
  });

  it('emits agent-failed and returns a failed result when the runtime rejects', async () => {
    const graph = new TaskGraph();
    const task = createTask({
      title: 'Implement API',
      description: 'Implement it',
      owner: 'backend',
    });
    graph.addTask(task);
    graph.setStatus(task.id, 'running');

    const runtime: AgentRuntime = {
      run: () => Promise.reject(new Error('runtime exploded')),

      stream: async function* () {},
    };
    const eventBus = new EventBus();

    const executor = new RuntimeAgentExecutor({
      runtime,
      contextBuilder: new DefaultContextBuilder(),
      repository,
      request: 'Add feature X',
      eventBus,
    });

    const result = await executor.execute(task, backendAgent, graph);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['runtime exploded']);
    expect(eventBus.getHistory().map((event) => event.type)).toEqual([
      'agent-started',
      'agent-failed',
    ]);
  });
});
