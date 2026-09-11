import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ValidationError } from '../shared/errors.js';
import { teamConfigSchema, type TeamConfig } from './team-config-schema.js';

/** Loads and validates `<crewforgeDir>/team.yaml`. */
export async function loadTeamConfig(crewforgeDir: string): Promise<TeamConfig> {
  const path = join(crewforgeDir, 'team.yaml');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    throw new ValidationError(`Could not read team config at ${path}`, { cause });
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    throw new ValidationError(`${path} is not valid YAML`, { cause });
  }

  const result = teamConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(`${path} failed validation: ${result.error.message}`);
  }
  return result.data;
}
