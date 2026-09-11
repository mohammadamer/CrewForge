import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathExists } from '../shared/fs-utils.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { loadAgentDefinition } from '../config/load-agent-definition.js';
import type { AgentDefinition } from './types.js';

export interface AgentRegistryOptions {
  /** Directory containing per-agent Markdown definitions, i.e. `.crewforge/agents`. */
  agentsDir: string;
}

/** Loads and validates all agent definitions from `.crewforge/agents/*.md`. */
export class AgentRegistry {
  private readonly agentsDir: string;
  private definitions = new Map<string, AgentDefinition>();
  private loaded = false;

  constructor(options: AgentRegistryOptions) {
    this.agentsDir = options.agentsDir;
  }

  async load(): Promise<void> {
    const entries = await readdir(this.agentsDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

    const definitions = new Map<string, AgentDefinition>();
    for (const file of files) {
      const definition = await loadAgentDefinition(join(this.agentsDir, file.name));
      if (definitions.has(definition.role)) {
        throw new ValidationError(`Duplicate agent role "${definition.role}" in ${this.agentsDir}`);
      }
      await this.validateKnowledgeRefs(definition);
      definitions.set(definition.role, definition);
    }
    this.definitions = definitions;
    this.loaded = true;
  }

  private async validateKnowledgeRefs(definition: AgentDefinition): Promise<void> {
    for (const ref of definition.knowledge) {
      const absolute = resolve(dirname(definition.sourcePath), ref);
      if (!(await pathExists(absolute))) {
        throw new ValidationError(
          `Agent "${definition.role}" references missing knowledge file "${ref}" (resolved to ${absolute})`,
        );
      }
    }
  }

  get(role: string): AgentDefinition {
    this.assertLoaded();
    const definition = this.definitions.get(role);
    if (!definition) {
      throw new NotFoundError(`No agent definition found for role "${role}"`);
    }
    return definition;
  }

  list(): AgentDefinition[] {
    this.assertLoaded();
    return [...this.definitions.values()];
  }

  has(role: string): boolean {
    return this.definitions.has(role);
  }

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new ValidationError('AgentRegistry.load() must be called before it can be queried');
    }
  }
}
