import { z } from 'zod';
import type { AgentDefinition, AgentRuntime } from '../agents/index.js';
import type { ContextBuilder } from '../context/context-builder.js';
import type { RepositorySummary } from '../context/types.js';
import { createAgentEvent } from '../events/factory.js';
import type { EventBus } from '../events/event-bus.js';
import { createTask } from '../tasks/factory.js';
import type { Task } from '../tasks/types.js';
import { DeterministicTaskPlanner } from './task-planner.js';
import type { TaskPlanner } from './task-planner.js';

const plannedTaskSchema = z.object({
  /** Temporary local identifier used only to express dependencies within this plan. */
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  owner: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
});

const taskPlanSchema = z.object({
  tasks: z.array(plannedTaskSchema).min(1),
});

export interface AiTaskPlannerOptions {
  runtime: AgentRuntime;
  leadAgent: AgentDefinition;
  contextBuilder: ContextBuilder;
  eventBus?: EventBus;
}

/**
 * AI-driven planner: asks the Lead's `AgentRuntime` to produce a JSON task plan,
 * validates it, and materializes real `Task`s with generated ids and resolved
 * dependencies. Falls back to `DeterministicTaskPlanner` whenever the runtime call
 * fails or the response isn't a valid plan, rather than ever failing the run outright.
 */
export class AiTaskPlanner implements TaskPlanner {
  private readonly fallback = new DeterministicTaskPlanner();

  constructor(private readonly options: AiTaskPlannerOptions) {}

  async plan(
    request: string,
    repository: RepositorySummary,
    availableRoles: string[],
  ): Promise<Task[]> {
    const tasks = await this.tryAiPlan(request, repository, availableRoles);
    if (tasks && tasks.length > 0) return tasks;

    this.options.eventBus?.publish(
      createAgentEvent(
        'agent-message',
        {
          message:
            'AI planner unavailable or returned an invalid plan; using deterministic fallback',
        },
        { agentId: this.options.leadAgent.role },
      ),
    );
    return this.fallback.plan(request, repository, availableRoles);
  }

  private async tryAiPlan(
    request: string,
    repository: RepositorySummary,
    availableRoles: string[],
  ): Promise<Task[] | undefined> {
    const { runtime, leadAgent, contextBuilder } = this.options;
    try {
      // A lightweight placeholder task purely to satisfy AgentContext's shape;
      // it is never added to the real graph.
      const planningTask = createTask({
        title: 'Plan implementation approach',
        description: request,
        owner: leadAgent.role,
      });
      const context = await contextBuilder.build(planningTask, leadAgent, repository, { request });

      const result = await runtime.run({
        agentRole: leadAgent.role,
        systemPrompt: buildPlanningSystemPrompt(leadAgent.instructions, availableRoles),
        context,
      });

      return materializePlan(result.summary, availableRoles);
    } catch {
      return undefined;
    }
  }
}

function buildPlanningSystemPrompt(leadInstructions: string, availableRoles: string[]): string {
  return [
    leadInstructions,
    '',
    'You must respond with ONLY a JSON object (no prose, no code fences) matching:',
    '{"tasks":[{"key":string,"title":string,"description":string,"owner":string,"dependsOn":string[]}]}',
    `"owner" must be one of: ${availableRoles.join(', ')}.`,
    '"dependsOn" references other tasks by their "key", not a real id.',
  ].join('\n');
}

function materializePlan(rawOutput: string, availableRoles: string[]): Task[] | undefined {
  const parsedJson = tryParseJson(extractJsonBlock(rawOutput));
  if (parsedJson === undefined) return undefined;

  const parsed = taskPlanSchema.safeParse(parsedJson);
  if (!parsed.success) return undefined;

  const keyToId = new Map<string, string>();
  const drafts = parsed.data.tasks.map((planned) => {
    const owner =
      planned.owner && availableRoles.includes(planned.owner) ? planned.owner : undefined;
    const task = createTask({ title: planned.title, description: planned.description, owner });
    keyToId.set(planned.key, task.id);
    return { task, dependsOnKeys: planned.dependsOn };
  });

  for (const { task, dependsOnKeys } of drafts) {
    task.dependencies = dependsOnKeys
      .map((key) => keyToId.get(key))
      .filter((id): id is string => id !== undefined);
  }

  return drafts.map(({ task }) => task);
}

function extractJsonBlock(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text)?.trim() ?? '';
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
