import * as vscode from 'vscode';
import type { AgentEvent, AgentRequest, AgentResult, AgentRuntime } from '@crewforge/core';
import { createAgentEvent } from '@crewforge/core';
import { renderAgentPrompt } from '@crewforge/runtime';

export interface VsCodeLmRuntimeOptions {
  /** e.g. `{ vendor: 'copilot', family: 'gpt-4o' }`; omit to use whatever's available. */
  modelSelector?: vscode.LanguageModelChatSelector;
}

/**
 * The "real" Copilot-backed `AgentRuntime`: `vscode.lm` is the actual, sanctioned way to
 * invoke Copilot's models programmatically today, but only from inside a VS Code
 * extension host — this is why `CopilotRuntime` (`@crewforge/runtime`, used by the CLI)
 * has to be a provisional OpenAI-compatible stand-in instead. This is the runtime that
 * stand-in was always meant to be superseded by, for the surface where a real one exists.
 */
export class VsCodeLmRuntime implements AgentRuntime {
  constructor(private readonly options: VsCodeLmRuntimeOptions = {}) {}

  async run(request: AgentRequest): Promise<AgentResult> {
    const model = await this.selectModel();
    const messages = [
      vscode.LanguageModelChatMessage.User(request.systemPrompt),
      vscode.LanguageModelChatMessage.User(renderAgentPrompt(request)),
    ];

    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token,
    );
    let summary = '';
    for await (const fragment of response.text) summary += fragment;

    return { success: true, summary, filesChanged: [], artifacts: [], errors: [] };
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

  private async selectModel(): Promise<vscode.LanguageModelChat> {
    const models = await vscode.lm.selectChatModels(
      this.options.modelSelector ?? { vendor: 'copilot' },
    );
    const [model] = models;
    if (!model) {
      throw new Error(
        'No Copilot language model is available. Make sure GitHub Copilot Chat is installed and signed in.',
      );
    }
    return model;
  }
}
