import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { ValidationError } from '../shared/errors.js';
import type { AgentDefinition } from '../agents/types.js';
import { agentFrontmatterSchema } from './agent-definition-schema.js';
import { splitFrontmatter } from './frontmatter.js';

export async function loadAgentDefinition(filePath: string): Promise<AgentDefinition> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (cause) {
    throw new ValidationError(`Could not read agent definition at ${filePath}`, { cause });
  }

  const { frontmatter, body } = splitFrontmatter(raw);
  if (!frontmatter) {
    throw new ValidationError(`Agent definition at ${filePath} is missing YAML frontmatter`);
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = parseYaml(frontmatter);
  } catch (cause) {
    throw new ValidationError(`Agent definition at ${filePath} has invalid YAML frontmatter`, {
      cause,
    });
  }

  const result = agentFrontmatterSchema.safeParse(parsedYaml);
  if (!result.success) {
    throw new ValidationError(
      `Agent definition at ${filePath} failed validation: ${result.error.message}`,
    );
  }

  const data = result.data;
  return {
    role: data.role,
    displayName: data.displayName ?? data.role,
    responsibilities: data.responsibilities,
    constraints: data.constraints,
    knowledge: data.knowledge,
    permissions: data.permissions,
    instructions: body,
    sourcePath: filePath,
  };
}
