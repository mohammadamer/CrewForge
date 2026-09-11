import {
  AgentRegistry,
  createTask,
  DefaultContextBuilder,
  detectRepository,
  EventBus,
  RuntimeAgentExecutor,
  TaskGraph,
} from '@crewforge/core';
import type { AgentEvent, AgentResult, AgentRuntime } from '@crewforge/core';
import { agentsDirFor } from '../paths.js';

export interface AskOptions {
  cwd: string;
  role: string;
  question: string;
  runtime: AgentRuntime;
  onEvent?: (event: AgentEvent) => void;
}

/** Invokes a single agent directly, bypassing the task graph/scheduler entirely. */
export async function runAsk(options: AskOptions): Promise<AgentResult> {
  const registry = new AgentRegistry({ agentsDir: agentsDirFor(options.cwd) });
  await registry.load();
  const agent = registry.get(options.role);

  const repository = await detectRepository(options.cwd);
  const graph = new TaskGraph();
  const task = createTask({
    title: `Ask ${options.role}`,
    description: options.question,
    owner: options.role,
  });
  graph.addTask(task);
  graph.setStatus(task.id, 'running');

  const eventBus = new EventBus();
  if (options.onEvent) eventBus.onEvent(options.onEvent);

  const executor = new RuntimeAgentExecutor({
    runtime: options.runtime,
    contextBuilder: new DefaultContextBuilder(),
    repository,
    request: options.question,
    eventBus,
  });

  return executor.execute(task, agent, graph);
}
