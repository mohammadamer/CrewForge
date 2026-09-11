import type { AgentEvent, AgentRequest, AgentResult, AgentRuntime } from '@crewforge/core';
import { createAgentEvent } from '@crewforge/core';

export type MockResponder = (request: AgentRequest) => AgentResult | Promise<AgentResult>;

export interface MockRuntimeOptions {
  /** Called for every `run()`/`stream()` invocation; defaults to a canned success response. */
  respond?: MockResponder;
}

const DEFAULT_RESPONSE: AgentResult = {
  success: true,
  summary: 'Mock agent completed the task.',
  filesChanged: [],
  artifacts: [],
  errors: [],
};

/**
 * Deterministic, network-free `AgentRuntime`. Used by default whenever no AI
 * credentials are configured, and by every automated test in this repository.
 */
export class MockRuntime implements AgentRuntime {
  private readonly respond: MockResponder;

  constructor(options: MockRuntimeOptions = {}) {
    this.respond = options.respond ?? (() => DEFAULT_RESPONSE);
  }

  async run(request: AgentRequest): Promise<AgentResult> {
    return this.respond(request);
  }

  async *stream(request: AgentRequest): AsyncIterable<AgentEvent> {
    yield createAgentEvent('agent-started', { role: request.agentRole });
    const result = await this.run(request);
    yield createAgentEvent(result.success ? 'agent-completed' : 'agent-failed', {
      summary: result.summary,
    });
  }
}
