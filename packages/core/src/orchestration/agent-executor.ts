import type { AgentDefinition, AgentResult } from '../agents/index.js';
import type { TaskGraph } from '../tasks/task-graph.js';
import type { Task } from '../tasks/types.js';

/**
 * Executes a single task with its assigned agent. `graph` is passed per call (rather
 * than held by the executor) so a single executor instance can run tasks from any
 * graph — the graph doesn't exist yet when the executor is constructed.
 */
export interface AgentExecutor {
  execute(task: Task, agent: AgentDefinition, graph: TaskGraph): Promise<AgentResult>;
}
