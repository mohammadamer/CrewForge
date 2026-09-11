import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Writes via a temp file + rename so concurrent readers never see a partial write. */
export async function atomicWriteFile(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  const tempPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempPath, contents, 'utf8');
  await rename(tempPath, path);
}

export async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await atomicWriteFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
