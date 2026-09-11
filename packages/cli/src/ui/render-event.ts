import chalk from 'chalk';
import type { AgentEvent } from '@crewforge/core';

const ROLE_ICONS: Record<string, string> = {
  lead: '\u{1F451}',
  architect: '\u{1F3DB}\u{FE0F}',
  backend: '\u2699\u{FE0F}',
  frontend: '\u{1F3A8}',
  qa: '\u{1F9EA}',
  security: '\u{1F510}',
  devops: '\u{1F680}',
  documentation: '\u{1F4DD}',
};

function iconFor(role: string | undefined): string {
  return (role && ROLE_ICONS[role]) || '\u{1F916}';
}

function stringField(data: unknown, key: string): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Renders a single `AgentEvent` as a one-line, human-friendly, colored string. */
export function renderEvent(event: AgentEvent): string {
  const icon = iconFor(event.agentId);
  const role = event.agentId ? chalk.bold(event.agentId) : chalk.dim('lead');

  switch (event.type) {
    case 'agent-started':
      return `${icon} ${role} ${chalk.dim('starting...')}`;
    case 'agent-completed':
      return `${chalk.green('\u2713')} ${role} ${stringField(event.data, 'summary') ?? 'completed'}`;
    case 'agent-failed':
      return `${chalk.red('\u2717')} ${role} ${
        stringField(event.data, 'summary') ?? stringField(event.data, 'error') ?? 'failed'
      }`;
    case 'agent-message':
      return `${chalk.yellow('\u2139')} ${stringField(event.data, 'message') ?? ''}`;
    default:
      return `${icon} ${role} ${chalk.dim(event.type)}`;
  }
}
