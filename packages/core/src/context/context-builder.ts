import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AgentDefinition } from '../agents/types.js';
import type { MCPToolDescriptor } from '../mcp/types.js';
import type { Task } from '../tasks/types.js';
import type {
  AgentContext,
  DecisionExcerpt,
  DependentTaskResult,
  KnowledgeExcerpt,
  RepositorySummary,
} from './types.js';

export interface ContextBuildOptions {
  /** The original, overall user request this task is part of. */
  request: string;
  dependentResults?: DependentTaskResult[];
  priorDecisions?: DecisionExcerpt[];
  /** Pre-fetched via `GitProvider`; this builder never talks to Git directly. */
  relevantDiff?: string;
  /** Set when the task is running in an isolated git worktree. */
  workingDirectory?: string;
  availableTools?: MCPToolDescriptor[];
}

export interface ContextBuilder {
  build(
    task: Task,
    agent: AgentDefinition,
    repository: RepositorySummary,
    options: ContextBuildOptions,
  ): Promise<AgentContext>;
}

/**
 * Default `ContextBuilder`: loads the knowledge files an agent's definition references.
 * Stateless across calls so a single instance can be reused for every task in a run \u2014
 * per-task data (request, dependent results, prior decisions) is passed in per call.
 * Relevant-file and diff enrichment are layered on by the orchestration/Git layers
 * (later phases) rather than baked in here, so this stays a small, replaceable default.
 */
export class DefaultContextBuilder implements ContextBuilder {
  async build(
    task: Task,
    agent: AgentDefinition,
    repository: RepositorySummary,
    options: ContextBuildOptions,
  ): Promise<AgentContext> {
    return {
      request: options.request,
      task,
      agentDefinition: agent,
      repository,
      relevantFiles: [],
      relevantKnowledge: await this.loadKnowledge(agent),
      priorDecisions: options.priorDecisions ?? [],
      dependentResults: options.dependentResults ?? [],
      relevantDiff: options.relevantDiff,
      workingDirectory: options.workingDirectory,
      availableTools: options.availableTools,
    };
  }

  private async loadKnowledge(agent: AgentDefinition): Promise<KnowledgeExcerpt[]> {
    const entries: KnowledgeExcerpt[] = [];
    for (const knowledgePath of agent.knowledge) {
      const absolutePath = resolve(dirname(agent.sourcePath), knowledgePath);
      try {
        const content = await readFile(absolutePath, 'utf8');
        entries.push({ path: knowledgePath, content });
      } catch {
        // Missing knowledge files are surfaced by AgentRegistry validation, not here.
      }
    }
    return entries;
  }
}
