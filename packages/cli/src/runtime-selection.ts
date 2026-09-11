import type { AgentRuntime } from '@crewforge/core';
import { CopilotRuntime, MockRuntime } from '@crewforge/runtime';

export type RuntimeChoice = 'mock' | 'copilot';

export interface ResolveRuntimeOptions {
  /** Explicit choice, usually from a `--runtime` CLI flag. */
  choice?: RuntimeChoice;
}

/**
 * Picks the `AgentRuntime` implementation: an explicit `--runtime` flag wins;
 * otherwise `CopilotRuntime` is used only when credentials are present, falling
 * back to `MockRuntime` so the CLI always works without any AI credentials.
 */
export function resolveRuntime(options: ResolveRuntimeOptions = {}): AgentRuntime {
  const choice = options.choice ?? defaultRuntimeChoice();
  if (choice === 'copilot') {
    return new CopilotRuntime();
  }
  return new MockRuntime();
}

function defaultRuntimeChoice(): RuntimeChoice {
  const hasCredentials = Boolean(process.env.CREWFORGE_MODEL_API_KEY ?? process.env.GITHUB_TOKEN);
  return hasCredentials ? 'copilot' : 'mock';
}
