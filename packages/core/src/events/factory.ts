import { generateId } from '../shared/id.js';
import type { AgentEvent, AgentEventType } from './types.js';

/** Builds a well-formed `AgentEvent`, filling in `id` and `timestamp`. */
export function createAgentEvent<TData = Record<string, unknown>>(
  type: AgentEventType,
  data: TData,
  context: { taskId?: string; agentId?: string } = {},
): AgentEvent<TData> {
  return {
    id: generateId(),
    type,
    data,
    timestamp: new Date().toISOString(),
    ...context,
  };
}
