import type { AgentRequest } from '@crewforge/core';

/**
 * Renders an `AgentContext` into the single user-turn prompt text every chat-completions-
 * style runtime sends (`CopilotRuntime`, and the VS Code extension's `vscode.lm`-backed
 * runtime). Shared so the two adapters can't drift on what context an agent actually sees.
 */
export function renderAgentPrompt(request: AgentRequest): string {
  const { context } = request;
  const lines = [
    `Request: ${context.request}`,
    `Task: ${context.task.title}`,
    context.task.description,
  ];

  if (context.relevantKnowledge.length > 0) {
    lines.push('', 'Knowledge:');
    for (const entry of context.relevantKnowledge) {
      lines.push(`--- ${entry.path} ---`, entry.content);
    }
  }

  if (context.dependentResults.length > 0) {
    lines.push('', 'Dependent task results:');
    for (const dep of context.dependentResults) {
      lines.push(`- ${dep.taskId}: ${dep.summary}`);
    }
  }

  if (context.relevantDiff) {
    lines.push('', 'Relevant diff:', context.relevantDiff);
  }

  if (context.availableTools && context.availableTools.length > 0) {
    lines.push('', 'Available MCP tools:');
    for (const tool of context.availableTools) {
      lines.push(`- ${tool.server}/${tool.name}${tool.description ? `: ${tool.description}` : ''}`);
    }
  }

  return lines.join('\n');
}
