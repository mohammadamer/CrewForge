import type { AgentDefinition } from '../agents/types.js';
import type { Task } from '../tasks/types.js';

export interface RepositorySummary {
  rootPath: string;
  language?: string;
  packageManager?: string;
  hasTests: boolean;
  hasLint: boolean;
  hasBuild: boolean;
  entryPoints: string[];
  /** Top-level file/directory listing (not a full recursive tree). */
  structure: string[];
}

export interface KnowledgeExcerpt {
  path: string;
  content: string;
}

export interface DecisionExcerpt {
  id: string;
  title: string;
  summary: string;
}

export interface DependentTaskResult {
  taskId: string;
  summary: string;
}

export interface RelevantFile {
  path: string;
  content: string;
}

/**
 * Everything a single agent needs for a single task \u2014 nothing more.
 * `ContextBuilder` assembles this so agents never receive the whole repository by default.
 */
export interface AgentContext {
  request: string;
  task: Task;
  agentDefinition: AgentDefinition;
  repository: RepositorySummary;
  relevantFiles: RelevantFile[];
  relevantKnowledge: KnowledgeExcerpt[];
  priorDecisions: DecisionExcerpt[];
  dependentResults: DependentTaskResult[];
  /** Populated by `RuntimeAgentExecutor` from `GitProvider.diff()` when one is configured. */
  relevantDiff?: string;
  /** Set when the task runs in an isolated git worktree rather than the main working tree. */
  workingDirectory?: string;
}
