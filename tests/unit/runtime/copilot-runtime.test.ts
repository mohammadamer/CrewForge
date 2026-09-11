import { describe, expect, it, vi } from 'vitest';
import { CopilotRuntime } from '@crewforge/runtime';
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
  relevantKnowledge: [{ path: '../knowledge/conventions.md', content: 'Use tabs.' }],
  priorDecisions: [],
  dependentResults: [{ taskId: 'task-0', summary: 'Architecture decided' }],
};

const request: AgentRequest = {
  agentRole: 'backend',
  systemPrompt: 'You implement backend code.',
  context,
};

function fakeFetch(response: { ok: boolean; status?: number; body: unknown }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  }) as unknown as typeof fetch;
}

describe('CopilotRuntime', () => {
  it('throws when no API key is available', () => {
    const originalToken = process.env.GITHUB_TOKEN;
    const originalKey = process.env.CREWFORGE_MODEL_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.CREWFORGE_MODEL_API_KEY;

    expect(() => new CopilotRuntime()).toThrow(/requires an API key/);

    if (originalToken) process.env.GITHUB_TOKEN = originalToken;
    if (originalKey) process.env.CREWFORGE_MODEL_API_KEY = originalKey;
  });

  it('sends an OpenAI-compatible chat-completions request and parses the response', async () => {
    const fetchImpl = fakeFetch({
      ok: true,
      body: { choices: [{ message: { content: 'Implemented the API.' } }] },
    });
    const runtime = new CopilotRuntime({ apiKey: 'test-key', fetchImpl });

    const result = await runtime.run(request);

    expect(result.success).toBe(true);
    expect(result.summary).toBe('Implemented the API.');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://models.github.ai/inference/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );

    const body = JSON.parse(
      (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body.model).toBe('openai/gpt-4o-mini');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You implement backend code.' });
    expect(body.messages[1].content).toContain('Task: Do thing');
    expect(body.messages[1].content).toContain('Architecture decided');
  });

  it('respects custom baseUrl/model overrides', async () => {
    const fetchImpl = fakeFetch({ ok: true, body: { choices: [{ message: { content: 'ok' } }] } });
    const runtime = new CopilotRuntime({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/inference',
      model: 'custom/model',
      fetchImpl,
    });

    await runtime.run(request);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/inference/chat/completions',
      expect.anything(),
    );
    const body = JSON.parse(
      (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body.model).toBe('custom/model');
  });

  it('throws when the endpoint responds with a non-ok status', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 401, body: { error: 'unauthorized' } });
    const runtime = new CopilotRuntime({ apiKey: 'bad-key', fetchImpl });

    await expect(runtime.run(request)).rejects.toThrow(/CopilotRuntime request failed \(401\)/);
  });

  it('streams a failed event when the underlying request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const runtime = new CopilotRuntime({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const events = [];
    for await (const event of runtime.stream(request)) {
      events.push(event);
    }
    expect(events.map((e) => e.type)).toEqual(['agent-started', 'agent-failed']);
  });
});
