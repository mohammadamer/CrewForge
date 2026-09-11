import {
  AgentRegistry,
  AiTaskPlanner,
  CommandVerificationRunner,
  createTask,
  DefaultContextBuilder,
  DeterministicTaskPlanner,
  detectRepository,
  EventBus,
  executeRun,
  generatePrefixedId,
  LocalGitProvider,
  loadTeamConfig,
  MemoryStore,
  pathExists,
  RuntimeAgentExecutor,
  SessionStore,
  TaskStore,
  ValidationError,
  WorktreeCoordinator,
} from '@crewforge/core';
import type {
  AgentDefinition,
  AgentEvent,
  AgentRuntime,
  ConflictGroup,
  ContextBuilder,
  OrchestrationSummary,
  RepositorySummary,
  SessionSummary,
  Task,
} from '@crewforge/core';
import { join } from 'node:path';
import { agentsDirFor, crewforgeDirFor } from '../paths.js';

export interface RunOptions {
  cwd: string;
  request: string;
  runtime: AgentRuntime;
  onEvent?: (event: AgentEvent) => void;
}

export interface RunOutcome {
  runId: string;
  summary: OrchestrationSummary;
  sessionSummary: SessionSummary;
  /** Mirrors `team.yaml`'s `workflow.human_approval` toggle. */
  requiresApproval: boolean;
}

export async function runRun(options: RunOptions): Promise<RunOutcome> {
  const crewforgeDir = crewforgeDirFor(options.cwd);
  const teamConfig = await loadTeamConfig(crewforgeDir);

  const registry = new AgentRegistry({ agentsDir: agentsDirFor(options.cwd) });
  await registry.load();

  const repository = await detectRepository(options.cwd);
  const eventBus = new EventBus();
  if (options.onEvent) eventBus.onEvent(options.onEvent);

  const contextBuilder = new DefaultContextBuilder();
  const memoryStore = new MemoryStore({ crewforgeDir });
  const gitProvider = new LocalGitProvider({ cwd: options.cwd });
  const createGitProviderForCwd = (cwd: string) => new LocalGitProvider({ cwd });

  const executor = new RuntimeAgentExecutor({
    runtime: options.runtime,
    contextBuilder,
    repository,
    request: options.request,
    eventBus,
    memoryStore,
    gitProvider,
    createGitProviderForCwd,
  });

  const worktrees = teamConfig.workflow.worktrees
    ? new WorktreeCoordinator({
        gitProvider,
        createGitProvider: createGitProviderForCwd,
        worktreesDir: join(crewforgeDir, 'worktrees'),
      })
    : undefined;

  if (teamConfig.workflow.worktrees && !(await pathExists(join(options.cwd, '.git')))) {
    throw new ValidationError(
      'workflow.worktrees is enabled but this is not a git repository — run `git init` first or set workflow.worktrees: false in team.yaml.',
    );
  }

  const planner = registry.has(teamConfig.lead)
    ? new AiTaskPlanner({
        runtime: options.runtime,
        leadAgent: registry.get(teamConfig.lead),
        contextBuilder,
        eventBus,
      })
    : new DeterministicTaskPlanner();

  const leadAgent = registry.has(teamConfig.lead) ? registry.get(teamConfig.lead) : undefined;

  const startedAt = Date.now();
  const summary = await executeRun(options.request, repository, {
    registry,
    planner,
    executor,
    worktrees,
    verification: {
      enabled: teamConfig.workflow.verification,
      config: teamConfig.verification,
      runner: new CommandVerificationRunner({ cwd: options.cwd }),
    },
    resolveConflict: (conflict, tasks) =>
      suggestConflictResolution(conflict, tasks, {
        runtime: options.runtime,
        leadAgent,
        contextBuilder,
        repository,
        request: options.request,
      }),
  });
  const completedAt = Date.now();

  const runId = generatePrefixedId('run');
  const taskStore = new TaskStore({ crewforgeDir });
  await taskStore.save(runId, options.request, summary.graph, new Date(startedAt).toISOString());

  const sessionSummary = buildSessionSummary(
    runId,
    options.request,
    startedAt,
    completedAt,
    summary,
  );
  const sessionStore = new SessionStore({ crewforgeDir });
  await sessionStore.save(sessionSummary);

  return { runId, summary, sessionSummary, requiresApproval: teamConfig.workflow.human_approval };
}

/** Marks every `completed`/`needs-review` task `approved` and re-persists the graph + session record. */
export async function approveRun(cwd: string, runId: string): Promise<void> {
  const crewforgeDir = crewforgeDirFor(cwd);
  const taskStore = new TaskStore({ crewforgeDir });
  const { request, createdAt, graph } = await taskStore.load(runId);

  for (const task of graph.listTasks()) {
    if (task.status === 'completed' || task.status === 'needs-review') {
      graph.setStatus(task.id, 'approved');
    }
  }

  await taskStore.save(runId, request, graph, createdAt);
}

interface ConflictResolutionDeps {
  runtime: AgentRuntime;
  leadAgent?: AgentDefinition;
  contextBuilder: ContextBuilder;
  repository: RepositorySummary;
  request: string;
}

/** Asks the Lead agent to analyze a file conflict; returns undefined if no Lead is configured. */
async function suggestConflictResolution(
  conflict: ConflictGroup,
  tasks: Task[],
  deps: ConflictResolutionDeps,
): Promise<string | undefined> {
  if (!deps.leadAgent) return undefined;

  const conflictingTasks = tasks.filter((task) => conflict.taskIds.includes(task.id));
  const description = `Two tasks both modified "${conflict.file}": ${conflictingTasks
    .map((task) => `"${task.title}" (${task.owner ?? 'unassigned'})`)
    .join(' and ')}. Suggest how to reconcile their changes without discarding either.`;

  const syntheticTask = createTask({ title: `Resolve conflict in ${conflict.file}`, description });
  const context = await deps.contextBuilder.build(syntheticTask, deps.leadAgent, deps.repository, {
    request: deps.request,
  });

  const result = await deps.runtime.run({
    agentRole: deps.leadAgent.role,
    systemPrompt: deps.leadAgent.instructions,
    context,
  });
  return result.summary;
}

function buildSessionSummary(
  runId: string,
  request: string,
  startedAt: number,
  completedAt: number,
  summary: OrchestrationSummary,
): SessionSummary {
  const tasks = summary.graph.listTasks();
  const agentCounts: Record<string, number> = {};
  const filesChanged = new Set<string>();

  for (const task of tasks) {
    if (task.owner) {
      agentCounts[task.owner] = (agentCounts[task.owner] ?? 0) + 1;
    }
    for (const file of task.result?.filesChanged ?? []) {
      filesChanged.add(file);
    }
  }

  return {
    runId,
    request,
    createdAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    durationMs: completedAt - startedAt,
    agentCounts,
    filesChanged: [...filesChanged],
    tasksTotal: tasks.length,
    tasksCompleted: tasks.filter(
      (task) => task.status === 'completed' || task.status === 'approved',
    ).length,
    tasksFailed: tasks.filter((task) => task.status === 'failed').length,
    tasksNeedsReview: tasks.filter((task) => task.status === 'needs-review').length,
    conflicts: summary.conflicts,
    worktreeConflicts: summary.worktreeConflicts,
    verification: summary.verification,
  };
}
