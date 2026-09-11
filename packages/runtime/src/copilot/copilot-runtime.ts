import type { AgentEvent, AgentRequest, AgentResult, AgentRuntime } from '@crewforge/core';
import { createAgentEvent } from '@crewforge/core';
import { renderAgentPrompt } from '../prompt.js';

export interface CopilotRuntimeOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://models.github.ai/inference';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

/**
 * `AgentRuntime` adapter over an OpenAI-compatible chat-completions endpoint.
 * Defaults to GitHub Models (`https://models.github.ai/inference`) using a
 * `GITHUB_TOKEN`. This is a provisional stand-in: there is currently no public,
 * standalone Node.js SDK for invoking GitHub Copilot's models outside the VS Code
 * extension host. Once the VS Code extension (later phase) ships a `vscode.lm`-backed
 * runtime, that becomes the primary "real" Copilot integration.
 */
export class CopilotRuntime implements AgentRuntime {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CopilotRuntimeOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.CREWFORGE_MODEL_BASE_URL ?? DEFAULT_BASE_URL;

    const apiKey =
      options.apiKey ?? process.env.CREWFORGE_MODEL_API_KEY ?? process.env.GITHUB_TOKEN;
    if (!apiKey) {
      throw new Error(
        'CopilotRuntime requires an API key: set CREWFORGE_MODEL_API_KEY or GITHUB_TOKEN.',
      );
    }
    this.apiKey = apiKey;

    this.model = options.model ?? process.env.CREWFORGE_MODEL_NAME ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async run(request: AgentRequest): Promise<AgentResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: renderAgentPrompt(request) },
    ];

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CopilotRuntime request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices[0]?.message.content ?? '';

    return {
      success: true,
      summary: content,
      filesChanged: [],
      artifacts: [],
      errors: [],
    };
  }

  async *stream(request: AgentRequest): AsyncIterable<AgentEvent> {
    yield createAgentEvent('agent-started', { role: request.agentRole });
    try {
      const result = await this.run(request);
      yield createAgentEvent('agent-completed', { summary: result.summary });
    } catch (error) {
      yield createAgentEvent('agent-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
