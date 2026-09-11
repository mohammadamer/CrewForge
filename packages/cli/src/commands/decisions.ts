import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '@crewforge/core';
import { crewforgeDirFor } from '../paths.js';

export interface DecisionSummary {
  id: string;
  title: string;
}

const TITLE_PATTERN = /^#\s+(.+)$/m;

/** Lists ADRs under `.crewforge/decisions/` (not `archive/`), ordered by filename. */
export async function runDecisions(cwd: string): Promise<DecisionSummary[]> {
  const dir = join(crewforgeDirFor(cwd), 'decisions');
  if (!(await pathExists(dir))) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

  const summaries: DecisionSummary[] = [];
  for (const file of files) {
    const content = await readFile(join(dir, file.name), 'utf8');
    const titleMatch = TITLE_PATTERN.exec(content);
    summaries.push({
      id: file.name.replace(/\.md$/, ''),
      title: titleMatch?.[1]?.trim() ?? file.name,
    });
  }
  return summaries.sort((a, b) => a.id.localeCompare(b.id));
}

export async function runDecisionShow(cwd: string, id: string): Promise<string> {
  const path = join(crewforgeDirFor(cwd), 'decisions', `${id}.md`);
  return readFile(path, 'utf8');
}
