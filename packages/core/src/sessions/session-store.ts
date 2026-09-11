import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { NotFoundError } from '../shared/errors.js';
import { pathExists, readJsonFile, writeJsonFile } from '../shared/fs-utils.js';
import type { SessionSummary } from './types.js';

export interface SessionStoreOptions {
  /** Root of the `.crewforge` directory. */
  crewforgeDir: string;
}

/** Persists archived run records to `.crewforge/sessions/<runId>/summary.json`. */
export class SessionStore {
  private readonly crewforgeDir: string;

  constructor(options: SessionStoreOptions) {
    this.crewforgeDir = options.crewforgeDir;
  }

  async save(summary: SessionSummary): Promise<void> {
    await writeJsonFile(this.path(summary.runId), summary);
  }

  async load(runId: string): Promise<SessionSummary> {
    const path = this.path(runId);
    if (!(await pathExists(path))) {
      throw new NotFoundError(`No session found for run "${runId}"`);
    }
    return readJsonFile<SessionSummary>(path);
  }

  /** Lists all sessions, most recent first. */
  async list(): Promise<SessionSummary[]> {
    const sessionsDir = join(this.crewforgeDir, 'sessions');
    if (!(await pathExists(sessionsDir))) return [];

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const summaries: SessionSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        summaries.push(await this.load(entry.name));
      } catch {
        // Skip malformed/partial session directories rather than failing the whole list.
      }
    }
    return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private path(runId: string): string {
    return join(this.crewforgeDir, 'sessions', runId, 'summary.json');
  }
}
