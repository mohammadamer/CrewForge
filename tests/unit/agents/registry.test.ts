import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentRegistry, NotFoundError, ValidationError } from '@crewforge/core';

const validAgentsDir = fileURLToPath(
  new URL('../../fixtures/valid-crewforge/agents', import.meta.url),
);
const invalidAgentsDir = fileURLToPath(
  new URL('../../fixtures/invalid-crewforge/agents', import.meta.url),
);

describe('AgentRegistry', () => {
  it('loads all valid agent definitions and exposes them by role', async () => {
    const registry = new AgentRegistry({ agentsDir: validAgentsDir });
    await registry.load();

    expect(registry.has('lead')).toBe(true);
    expect(registry.has('backend')).toBe(true);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('lead').role).toBe('lead');
  });

  it('throws NotFoundError for an unknown role', async () => {
    const registry = new AgentRegistry({ agentsDir: validAgentsDir });
    await registry.load();
    expect(() => registry.get('nonexistent')).toThrow(NotFoundError);
  });

  it('throws ValidationError before load() has been called', () => {
    const registry = new AgentRegistry({ agentsDir: validAgentsDir });
    expect(() => registry.get('lead')).toThrow(ValidationError);
    expect(() => registry.list()).toThrow(ValidationError);
  });

  it('throws ValidationError when an agent references a missing knowledge file', async () => {
    const registry = new AgentRegistry({ agentsDir: invalidAgentsDir });
    await expect(registry.load()).rejects.toBeInstanceOf(ValidationError);
  });

  describe('duplicate role detection', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'crewforge-registry-dup-'));
      await mkdir(join(dir, 'knowledge'), { recursive: true });
      const body = [
        '---',
        'role: backend',
        'responsibilities:',
        '  - Something',
        'constraints:',
        '  - Something',
        'knowledge: []',
        '---',
        '',
        '# Backend',
      ].join('\n');
      await writeFile(join(dir, 'backend-a.md'), body, 'utf8');
      await writeFile(join(dir, 'backend-b.md'), body, 'utf8');
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('throws ValidationError when two files declare the same role', async () => {
      const registry = new AgentRegistry({ agentsDir: dir });
      await expect(registry.load()).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
