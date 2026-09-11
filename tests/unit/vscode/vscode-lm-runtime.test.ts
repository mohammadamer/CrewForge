import { describe, expect, it, vi } from 'vitest';
import { lm } from 'vscode';
import { VsCodeLmRuntime } from '@crewforge/vscode';
import type { AgentContext, AgentRequest } from '@crewforge/core';

function buildRequest(): AgentRequest {
  const context: AgentContext = {
    request: 'Add a health check endpoint',
    task: { id: 't1', title: 'Implement backend', description: 'Add /health' } as never,
    agentDefinition: { role: 'backend' } as never,
    repository: {
      rootPath: '/repo',
      hasTests: false,
      hasLint: false,
      hasBuild: false,
      entryPoints: [],
      structure: [],
    },
    relevantFiles: [],
    relevantKnowledge: [],
    priorDecisions: [],
    dependentResults: [],
  };
  return { agentRole: 'backend', systemPrompt: 'You are the backend engineer.', context };
}

describe('VsCodeLmRuntime', () => {
  it('run() sends the system + rendered context prompt and joins the streamed text', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: (async function* () {
        yield 'Added ';
        yield 'a health check endpoint.';
      })(),
    });
    vi.mocked(lm.selectChatModels).mockResolvedValue([{ sendRequest } as never]);

    const runtime = new VsCodeLmRuntime();
    const result = await runtime.run(buildRequest());

    expect(result).toEqual({
      success: true,
      summary: 'Added a health check endpoint.',
      filesChanged: [],
      artifacts: [],
      errors: [],
    });
    expect(sendRequest).toHaveBeenCalledOnce();
  });

  it('throws a clear error when no Copilot model is available', async () => {
    vi.mocked(lm.selectChatModels).mockResolvedValue([]);

    const runtime = new VsCodeLmRuntime();
    await expect(runtime.run(buildRequest())).rejects.toThrow(/No Copilot language model/);
  });

  it('stream() yields agent-started then agent-completed on success', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: (async function* () {
        yield 'done';
      })(),
    });
    vi.mocked(lm.selectChatModels).mockResolvedValue([{ sendRequest } as never]);

    const runtime = new VsCodeLmRuntime();
    const events = [];
    for await (const event of runtime.stream(buildRequest())) events.push(event.type);

    expect(events).toEqual(['agent-started', 'agent-completed']);
  });
});
