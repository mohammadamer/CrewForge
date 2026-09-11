import { loadTeamConfig } from '@crewforge/core';
import type { TeamConfig } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

export async function runTeam(cwd: string): Promise<TeamConfig> {
  return loadTeamConfig(crewforgeDirFor(cwd));
}
