import { describe, expect, it, vi } from 'vitest';
import { MockRuntime } from '@crewforge/runtime';
import type { AgentContext, AgentRequest } from '@crewforge/core';

const context: AgentContext = {
  request: 'Add feature',
  task: {
    id: 'task-1',
    title: 'Do thing',
    description: 'Do the thing',
    dependencies: [],
    status: 'running',
    createdAt: new Date().toISOString(),
    artifacts: [],
    errors: [],
  },
  agentDefinition: {
    role: 'backend',
    displayName: 'Backend',
    responsibilities: ['Implement'],
    constraints: ['Do not touch frontend'],
    knowledge: [],
    instructions: 'You implement backend code.',
    sourcePath: '/virtual/backend.md',
  },
  repository: {
    rootPath: '/repo',
    hasTests: true,
    hasLint: true,
    hasBuild: true,
    entryPoints: [],
    structure: [],
  },
  relevantFiles: [],
  relevantKnowledge: [],
  priorDecisions: [],
  dependentResults: [],
};

const request: AgentRequest = {
  agentRole: 'backend',
  systemPrompt: 'You implement backend code.',
  context,
};

describe('MockRuntime', () => {
  it('returns a canned success response by default', async () => {
    const runtime = new MockRuntime();
    const result = await runtime.run(request);
    expect(result.success).toBe(true);
    expect(result.summary).toContain('Mock agent completed');
  });

  it('uses a custom responder when provided', async () => {
    const respond = vi.fn().mockResolvedValue({
      success: false,
      summary: 'custom failure',
      filesChanged: [],
      artifacts: [],
      errors: ['nope'],
    });
    const runtime = new MockRuntime({ respond });
    const result = await runtime.run(request);

    expect(respond).toHaveBeenCalledWith(request);
    expect(result.success).toBe(false);
    expect(result.summary).toBe('custom failure');
  });

  it('streams a started event followed by a completed/failed event', async () => {
    const runtime = new MockRuntime();
    const events = [];
    for await (const event of runtime.stream(request)) {
      events.push(event);
    }
    expect(events.map((e) => e.type)).toEqual(['agent-started', 'agent-completed']);
  });
});
