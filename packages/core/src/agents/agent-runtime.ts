import type { AgentContext } from '../context/types.js';
import type { AgentEvent } from '../events/types.js';

export interface AgentRequest {
  agentRole: string;
  systemPrompt: string;
  context: AgentContext;
}

export interface AgentResultArtifact {
  path: string;
  description?: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  artifacts: AgentResultArtifact[];
  errors: string[];
}

/**
 * The execution port every AI backend must implement. Core depends only on this
 * interface, never on a concrete runtime (see `@crewforge/runtime` for adapters).
 */
export interface AgentRuntime {
  run(request: AgentRequest): Promise<AgentResult>;
  stream(request: AgentRequest): AsyncIterable<AgentEvent>;
}
