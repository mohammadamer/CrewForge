import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectRepository } from '@crewforge/core';

const nodeRepoDir = fileURLToPath(new URL('../../fixtures/repo-node', import.meta.url));

describe('detectRepository', () => {
  it('detects a Node.js repository with test/lint/build scripts and npm lockfile', async () => {
    const summary = await detectRepository(nodeRepoDir);

    expect(summary.language).toBe('javascript-typescript');
    expect(summary.packageManager).toBe('npm');
    expect(summary.hasTests).toBe(true);
    expect(summary.hasLint).toBe(true);
    expect(summary.hasBuild).toBe(true);
    expect(summary.entryPoints).toEqual(['index.js']);
    expect(summary.structure).toContain('package.json');
  });

  let emptyDir: string;

  beforeEach(async () => {
    emptyDir = await mkdtemp(join(tmpdir(), 'crewforge-repo-empty-'));
  });

  afterEach(async () => {
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('returns conservative defaults for a repository with no recognizable manifest', async () => {
    const summary = await detectRepository(emptyDir);

    expect(summary.language).toBeUndefined();
    expect(summary.packageManager).toBeUndefined();
    expect(summary.hasTests).toBe(false);
    expect(summary.hasLint).toBe(false);
    expect(summary.hasBuild).toBe(false);
    expect(summary.entryPoints).toEqual([]);
    expect(summary.structure).toEqual([]);
  });
});
