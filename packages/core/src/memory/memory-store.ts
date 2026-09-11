import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWriteFile, pathExists } from '../shared/fs-utils.js';
import type { AgentMemoryEntry } from './types.js';

export interface MemoryStoreOptions {
  /** Root of the `.crewforge` directory. */
  crewforgeDir: string;
  /** Once the rendered memory file would exceed this many characters, oldest entries are dropped. */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 4000;
const ENTRY_PATTERN = /^- \[(.+?)\](?: \((.+?)\))? (.*)$/;

/**
 * Reads/writes `.crewforge/agents/<role>/memory.md`. Kept small via truncation so it
 * never grows into an unbounded conversation transcript (see build.md's AGENT MEMORY section).
 */
export class MemoryStore {
  private readonly crewforgeDir: string;
  private readonly maxChars: number;

  constructor(options: MemoryStoreOptions) {
    this.crewforgeDir = options.crewforgeDir;
    this.maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  }

  async read(role: string): Promise<AgentMemoryEntry[]> {
    const path = this.memoryPath(role);
    if (!(await pathExists(path))) return [];
    const raw = await readFile(path, 'utf8');
    return parseMemoryMarkdown(raw);
  }

  async append(role: string, entry: AgentMemoryEntry): Promise<void> {
    const existing = await this.read(role);
    const summarized = this.summarize([...existing, entry]);
    await atomicWriteFile(this.memoryPath(role), renderMemoryMarkdown(role, summarized));
  }

  private memoryPath(role: string): string {
    return join(this.crewforgeDir, 'agents', role, 'memory.md');
  }

  /** Drops the oldest entries once the rendered file would exceed `maxChars`. */
  private summarize(entries: AgentMemoryEntry[]): AgentMemoryEntry[] {
    const trimmed = [...entries];
    while (renderMemoryMarkdown('_', trimmed).length > this.maxChars && trimmed.length > 1) {
      trimmed.shift();
    }
    return trimmed;
  }
}

function renderMemoryMarkdown(role: string, entries: AgentMemoryEntry[]): string {
  const header = `# ${role} memory\n\n`;
  const body = entries
    .map(
      (entry) =>
        `- [${entry.timestamp}]${entry.taskId ? ` (${entry.taskId})` : ''} ${entry.summary}`,
    )
    .join('\n');
  return `${header}${body}\n`;
}

function parseMemoryMarkdown(raw: string): AgentMemoryEntry[] {
  const entries: AgentMemoryEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('- [')) continue;
    const match = ENTRY_PATTERN.exec(line);
    if (!match) continue;
    const [, timestamp, taskId, summary] = match;
    entries.push({ timestamp: timestamp ?? '', taskId, summary: summary ?? '' });
  }
  return entries;
}
