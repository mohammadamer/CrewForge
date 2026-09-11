import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockRuntime } from '@crewforge/runtime';
import {
  approveRun,
  runAgentCreate,
  runAgents,
  runAsk,
  runDecisions,
  runDoctor,
  runHistory,
  runInit,
  runRun,
  runStatus,
  runTaskCreate,
  runTeam,
} from '@crewforge/cli';

describe('CLI workflow (integration)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-cli-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('init scaffolds .crewforge/ with the MVP team', async () => {
    const result = await runInit({ cwd, name: 'demo-team' });

    expect(result.createdFiles).toEqual(
      expect.arrayContaining([
        'team.yaml',
        'agents/lead.md',
        'agents/backend.md',
        'agents/frontend.md',
        'agents/qa.md',
        'knowledge/architecture.md',
        'knowledge/conventions.md',
        'knowledge/repository.md',
      ]),
    );

    const team = await runTeam(cwd);
    expect(team.name).toBe('demo-team');
    expect(team.agents).toEqual(['lead', 'backend', 'frontend', 'qa']);

    const agents = await runAgents(cwd);
    expect(agents.map((agent) => agent.role).sort()).toEqual(['backend', 'frontend', 'lead', 'qa']);
  });

  it('init refuses to overwrite without --force', async () => {
    await runInit({ cwd });
    await expect(runInit({ cwd })).rejects.toThrow(/already contains a team.yaml/);
    await expect(runInit({ cwd, force: true })).resolves.toBeDefined();
  });

  it('agent create scaffolds a template not activated by init', async () => {
    await runInit({ cwd });
    const path = await runAgentCreate({ cwd, role: 'security' });
    expect(path).toContain('security.md');

    const agents = await runAgents(cwd);
    expect(agents.map((agent) => agent.role)).toContain('security');
  });

  it('run executes end-to-end with MockRuntime and produces status/history records', async () => {
    await runInit({ cwd });

    const events: string[] = [];
    const outcome = await runRun({
      cwd,
      request: 'Add a health check endpoint',
      runtime: new MockRuntime(),
      onEvent: (event) => events.push(event.type),
    });

    expect(outcome.sessionSummary.tasksFailed).toBe(0);
    expect(outcome.sessionSummary.tasksCompleted).toBeGreaterThan(0);
    expect(events).toContain('agent-completed');

    const status = await runStatus(cwd);
    expect(status?.runId).toBe(outcome.runId);
    expect(status?.tasks.every((task) => task.status === 'completed')).toBe(true);

    await approveRun(cwd, outcome.runId);
    const approvedStatus = await runStatus(cwd);
    expect(approvedStatus?.tasks.every((task) => task.status === 'approved')).toBe(true);

    const history = await runHistory(cwd);
    expect(history.map((session) => session.runId)).toContain(outcome.runId);
  });

  it('status returns undefined and history is empty before any run', async () => {
    await runInit({ cwd });
    expect(await runStatus(cwd)).toBeUndefined();
    expect(await runHistory(cwd)).toEqual([]);
  });

  it('decisions is empty for a freshly initialized repository', async () => {
    await runInit({ cwd });
    expect(await runDecisions(cwd)).toEqual([]);
  });

  it('task create appends a standalone task run', async () => {
    await runInit({ cwd });
    const result = await runTaskCreate({ cwd, title: 'Investigate flaky test' });
    const status = await runStatus(cwd);
    expect(status?.runId).toBe(result.runId);
    expect(status?.tasks).toHaveLength(1);
    expect(status?.tasks[0]?.title).toBe('Investigate flaky test');
  });

  it('ask invokes a single agent without a task graph', async () => {
    await runInit({ cwd });
    const result = await runAsk({
      cwd,
      role: 'backend',
      question: 'What testing library do we use?',
      runtime: new MockRuntime(),
    });
    expect(result.success).toBe(true);
  });

  it('doctor reports unhealthy before init and healthy after', async () => {
    const before = await runDoctor(cwd);
    expect(before.healthy).toBe(false);

    await runInit({ cwd });
    const after = await runDoctor(cwd);
    expect(after.healthy).toBe(true);
  });
});
