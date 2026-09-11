import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CrewForgeError, loadTeamConfig, scaffoldCrewForge } from '@crewforge/core';

describe('scaffoldCrewForge', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'crewforge-scaffold-'));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  const agentTemplates = [
    {
      role: 'lead',
      fileName: 'lead.md',
      content:
        '---\nrole: lead\nresponsibilities:\n  - Coordinate\nconstraints:\n  - Do not implement\n---\n\n# Lead\n',
    },
    {
      role: 'backend',
      fileName: 'backend.md',
      content:
        '---\nrole: backend\nresponsibilities:\n  - Implement\nconstraints:\n  - No frontend\n---\n\n# Backend\n',
    },
  ];

  it('scaffolds team.yaml, agent files, knowledge, and empty directories', async () => {
    const result = await scaffoldCrewForge({ repoRoot, teamName: 'demo', agentTemplates });

    const teamConfig = await loadTeamConfig(result.crewforgeDir);
    expect(teamConfig.name).toBe('demo');
    expect(teamConfig.agents).toEqual(['lead', 'backend']);

    const leadFile = await readFile(join(result.crewforgeDir, 'agents', 'lead.md'), 'utf8');
    expect(leadFile).toContain('role: lead');

    const repoKnowledge = await readFile(
      join(result.crewforgeDir, 'knowledge', 'repository.md'),
      'utf8',
    );
    expect(repoKnowledge).toContain('# Repository');

    for (const dir of [['decisions', 'archive'], ['tasks', 'current'], ['sessions']]) {
      const stats = await stat(join(result.crewforgeDir, ...dir));
      expect(stats.isDirectory()).toBe(true);
    }
  });

  it('throws when team.yaml already exists and force is not set', async () => {
    await scaffoldCrewForge({ repoRoot, teamName: 'demo', agentTemplates });
    await expect(
      scaffoldCrewForge({ repoRoot, teamName: 'demo-2', agentTemplates }),
    ).rejects.toBeInstanceOf(CrewForgeError);
  });

  it('overwrites an existing team.yaml when force is set', async () => {
    await scaffoldCrewForge({ repoRoot, teamName: 'demo', agentTemplates });
    const result = await scaffoldCrewForge({
      repoRoot,
      teamName: 'demo-renamed',
      agentTemplates,
      force: true,
    });

    const teamConfig = await loadTeamConfig(result.crewforgeDir);
    expect(teamConfig.name).toBe('demo-renamed');
  });

  it('includes verification commands only for detected scripts', async () => {
    const { crewforgeDir } = await scaffoldCrewForge({
      repoRoot,
      teamName: 'demo',
      agentTemplates,
    });
    const teamConfig = await loadTeamConfig(crewforgeDir);
    expect(teamConfig.verification).toEqual({});
  });
});
