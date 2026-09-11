/**
 * Structured event types emitted during agent execution and orchestration.
 * These are the backbone for CLI/VS Code UIs and for `.crewforge/sessions` history.
 */
export type AgentEventType =
  | 'agent-started'
  | 'agent-thinking'
  | 'tool-called'
  | 'file-read'
  | 'file-changed'
  | 'command-executed'
  | 'test-started'
  | 'test-completed'
  | 'agent-message'
  | 'agent-completed'
  | 'agent-failed'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'approval-requested'
  | 'approval-resolved';

export interface AgentEvent<TData = Record<string, unknown>> {
  id: string;
  taskId?: string;
  agentId?: string;
  timestamp: string;
  type: AgentEventType;
  data: TData;
}
