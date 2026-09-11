import type { AgentDefinition, AgentResult, AgentRuntime } from '../agents/index.js';
import type { ContextBuilder } from '../context/context-builder.js';
import type { DependentTaskResult, RepositorySummary } from '../context/types.js';
import { createAgentEvent } from '../events/factory.js';
import type { EventBus } from '../events/event-bus.js';
import type { GitProvider } from '../git/types.js';
import type { MemoryStore } from '../memory/memory-store.js';
import type { TaskGraph } from '../tasks/task-graph.js';
import type { Task, TaskResult } from '../tasks/types.js';
import type { AgentExecutor } from './agent-executor.js';

/** Diffs beyond this size are truncated before being sent to an agent as context. */
const MAX_DIFF_CHARS = 4000;

export interface RuntimeAgentExecutorOptions {
  runtime: AgentRuntime;
  contextBuilder: ContextBuilder;
  repository: RepositorySummary;
  /** The overall user request this run was started for. */
  request: string;
  eventBus?: EventBus;
  memoryStore?: MemoryStore;
  /** When provided, the current working-tree diff is included in each task's context. */
  gitProvider?: GitProvider;
}

/**
 * The real `AgentExecutor`: builds per-task context, calls the injected `AgentRuntime`,
 * emits structured events, and records a memory entry for the agent. This is the only
 * place core depends on a concrete `AgentRuntime` instance \u2014 which one is used is
 * decided by the caller (CLI), never hard-coded here.
 */
export class RuntimeAgentExecutor implements AgentExecutor {
  constructor(private readonly options: RuntimeAgentExecutorOptions) {}

  async execute(task: Task, agent: AgentDefinition, graph: TaskGraph): Promise<AgentResult> {
    const { runtime, contextBuilder, repository, request, eventBus, memoryStore } = this.options;

    eventBus?.publish(
      createAgentEvent(
        'agent-started',
        { role: agent.role },
        { taskId: task.id, agentId: agent.role },
      ),
    );

    const context = await contextBuilder.build(task, agent, repository, {
      request,
      dependentResults: this.collectDependentResults(task, graph),
      relevantDiff: await this.fetchRelevantDiff(),
    });

    try {
      const result = await runtime.run({
        agentRole: agent.role,
        systemPrompt: agent.instructions,
        context,
      });

      eventBus?.publish(
        createAgentEvent(
          result.success ? 'agent-completed' : 'agent-failed',
          { summary: result.summary },
          { taskId: task.id, agentId: agent.role },
        ),
      );

      if (memoryStore) {
        await memoryStore.append(agent.role, {
          timestamp: new Date().toISOString(),
          taskId: task.id,
          summary: result.summary,
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      eventBus?.publish(
        createAgentEvent(
          'agent-failed',
          { error: message },
          { taskId: task.id, agentId: agent.role },
        ),
      );
      return {
        success: false,
        summary: `Agent execution failed: ${message}`,
        filesChanged: [],
        artifacts: [],
        errors: [message],
      };
    }
  }

  private collectDependentResults(task: Task, graph: TaskGraph): DependentTaskResult[] {
    return task.dependencies
      .map((depId) => graph.getTask(depId))
      .filter((dep): dep is Task & { result: TaskResult } => dep.result !== undefined)
      .map((dep) => ({ taskId: dep.id, summary: dep.result.summary }));
  }

  /** Best-effort: a missing/non-repo `GitProvider` should never fail agent execution. */
  private async fetchRelevantDiff(): Promise<string | undefined> {
    if (!this.options.gitProvider) return undefined;
    try {
      const { patch } = await this.options.gitProvider.diff();
      if (!patch) return undefined;
      return patch.length > MAX_DIFF_CHARS
        ? `${patch.slice(0, MAX_DIFF_CHARS)}\n… (truncated)`
        : patch;
    } catch {
      return undefined;
    }
  }
}
