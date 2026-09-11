import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandVerificationRunner } from '@crewforge/core';

describe('CommandVerificationRunner', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'crewforge-verify-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('reports overall pass when every configured command succeeds', async () => {
    const runner = new CommandVerificationRunner({ cwd });
    const summary = await runner.run({
      test: 'node -e "process.exit(0)"',
      lint: 'node -e "process.exit(0)"',
    });

    expect(summary.passed).toBe(true);
    expect(summary.results.map((r) => r.name)).toEqual(['test', 'lint']);
    expect(summary.results.every((r) => r.passed && r.exitCode === 0)).toBe(true);
  });

  it('reports overall failure when any configured command fails, capturing stderr', async () => {
    const runner = new CommandVerificationRunner({ cwd });
    const summary = await runner.run({
      test: 'node -e "console.error(\'boom\'); process.exit(1)"',
      build: 'node -e "process.exit(0)"',
    });

    expect(summary.passed).toBe(false);
    const test = summary.results.find((r) => r.name === 'test');
    expect(test?.passed).toBe(false);
    expect(test?.exitCode).toBe(1);
    expect(test?.stderr).toContain('boom');
    const build = summary.results.find((r) => r.name === 'build');
    expect(build?.passed).toBe(true);
  });

  it('skips commands that are not configured', async () => {
    const runner = new CommandVerificationRunner({ cwd });
    const summary = await runner.run({ lint: 'node -e "process.exit(0)"' });

    expect(summary.results).toHaveLength(1);
    expect(summary.results[0]?.name).toBe('lint');
  });

  it('passes trivially when no commands are configured', async () => {
    const runner = new CommandVerificationRunner({ cwd });
    const summary = await runner.run({});
    expect(summary).toEqual({ passed: true, results: [] });
  });
});
