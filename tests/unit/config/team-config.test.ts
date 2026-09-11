import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTeamConfig, teamConfigSchema, ValidationError } from '@crewforge/core';

const validDir = fileURLToPath(new URL('../../fixtures/valid-crewforge', import.meta.url));
const missingDir = fileURLToPath(new URL('../../fixtures/does-not-exist', import.meta.url));

describe('loadTeamConfig', () => {
  it('parses a valid team.yaml and applies defaults', async () => {
    const config = await loadTeamConfig(validDir);

    expect(config.name).toBe('demo-team');
    expect(config.lead).toBe('lead');
    expect(config.agents).toEqual(['lead', 'backend', 'frontend', 'qa']);
    expect(config.workflow).toEqual({
      planning: true,
      parallel_execution: true,
      verification: true,
      human_approval: true,
    });
    expect(config.verification).toEqual({
      test: 'npm test',
      lint: 'npm run lint',
      build: 'npm run build',
    });
    expect(config.permissions).toEqual({
      shell: 'restricted',
      network: 'restricted',
      filesystem: 'repository',
      deployment: 'approval-required',
    });
  });

  it('throws a ValidationError when team.yaml is missing', async () => {
    await expect(loadTeamConfig(missingDir)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('teamConfigSchema', () => {
  // YAML parses an empty mapping key (e.g. `verification:` with nothing under it) as
  // `null`, not "absent" — this must still fall back to the object defaults, not fail.
  it('treats null workflow/verification/permissions/mcp as absent and applies defaults', () => {
    const result = teamConfigSchema.parse({
      name: 'demo',
      agents: ['lead'],
      workflow: null,
      verification: null,
      permissions: null,
      mcp: null,
    });

    expect(result.workflow.human_approval).toBe(true);
    expect(result.verification).toEqual({});
    expect(result.permissions.shell).toBe('restricted');
    expect(result.mcp).toBeUndefined();
  });
});
