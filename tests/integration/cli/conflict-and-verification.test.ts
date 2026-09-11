import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockRuntime } from '@crewforge/runtime';
import type { AgentRequest, AgentResult } from '@crewforge/core';
import { approveRun, runInit, runRun, runStatus, runTeam } from '@crewforge/cli';

describe('conflict detection (integration)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-conflict-'));
    await runInit({ cwd });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('demotes two tasks that both reported changes to the same file to needs-review', async () => {
    const runtime = new MockRuntime({
      respond: (request: AgentRequest): AgentResult => {
        if (request.agentRole === 'backend' || request.agentRole === 'frontend') {
          return {
            success: true,
            summary: `${request.agentRole} touched the shared module`,
            filesChanged: ['src/shared.ts'],
            artifacts: [],
            errors: [],
          };
        }
        return { success: true, summary: 'ok', filesChanged: [], artifacts: [], errors: [] };
      },
    });

    const outcome = await runRun({ cwd, request: 'Add a shared utility', runtime });

    expect(outcome.summary.conflicts).toHaveLength(1);
    expect(outcome.summary.conflicts[0]?.file).toBe('src/shared.ts');

    const backendTask = outcome.summary.graph.listTasks().find((t) => t.owner === 'backend');
    const frontendTask = outcome.summary.graph.listTasks().find((t) => t.owner === 'frontend');
    expect(backendTask?.status).toBe('needs-review');
    expect(frontendTask?.status).toBe('needs-review');
    expect(outcome.sessionSummary.tasksNeedsReview).toBeGreaterThanOrEqual(2);

    // A human can still approve past the conflict once they've reviewed it.
    await approveRun(cwd, outcome.runId);
    const status = await runStatus(cwd);
    expect(status?.tasks.find((t) => t.id === backendTask?.id)?.status).toBe('approved');
  });
});

describe('verification failure (integration)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-verify-fail-'));
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify(
        { name: 'fixture', version: '0.0.0', scripts: { test: 'node -e "process.exit(1)"' } },
        null,
        2,
      ),
    );
    await runInit({ cwd });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('surfaces needs-review and blocks completion when the configured test command fails', async () => {
    const team = await runTeam(cwd);
    expect(team.verification.test).toBe('npm test');

    const outcome = await runRun({ cwd, request: 'Add a feature', runtime: new MockRuntime() });

    expect(outcome.summary.verification?.passed).toBe(false);
    expect(outcome.sessionSummary.tasksCompleted).toBe(0);
    expect(outcome.sessionSummary.tasksNeedsReview).toBeGreaterThan(0);

    // Human can still choose to approve despite the failing verification.
    await approveRun(cwd, outcome.runId);
    const status = await runStatus(cwd);
    expect(status?.tasks.every((t) => t.status === 'approved')).toBe(true);
  });
});
