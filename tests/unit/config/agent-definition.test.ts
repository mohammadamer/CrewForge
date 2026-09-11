import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAgentDefinition, ValidationError } from '@crewforge/core';

const validAgents = fileURLToPath(
  new URL('../../fixtures/valid-crewforge/agents', import.meta.url),
);
const invalidAgents = fileURLToPath(
  new URL('../../fixtures/invalid-crewforge/agents', import.meta.url),
);

describe('loadAgentDefinition', () => {
  it('parses frontmatter and body for a valid agent definition', async () => {
    const agent = await loadAgentDefinition(`${validAgents}/lead.md`);

    expect(agent.role).toBe('lead');
    expect(agent.displayName).toBe('Lead Engineer');
    expect(agent.responsibilities).toEqual(['Coordinate the team']);
    expect(agent.constraints).toEqual(['Do not implement code directly']);
    expect(agent.knowledge).toEqual(['../knowledge/architecture.md']);
    expect(agent.instructions).toContain('# Lead Engineer');
    expect(agent.sourcePath).toBe(`${validAgents}/lead.md`);
  });

  it('falls back to role as displayName when omitted', async () => {
    const agent = await loadAgentDefinition(`${validAgents}/backend.md`);
    expect(agent.displayName).toBe('Backend Engineer');
  });

  it('throws a ValidationError when frontmatter is missing', async () => {
    await expect(
      loadAgentDefinition(`${invalidAgents}/missing-frontmatter.md`),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws a ValidationError when constraints is empty', async () => {
    await expect(
      loadAgentDefinition(`${invalidAgents}/empty-constraints.md`),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws a ValidationError for a nonexistent file', async () => {
    await expect(loadAgentDefinition(`${validAgents}/does-not-exist.md`)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
