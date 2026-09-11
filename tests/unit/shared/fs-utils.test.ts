import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWriteFile, pathExists, readJsonFile, writeJsonFile } from '@crewforge/core';

describe('fs-utils', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crewforge-fs-utils-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports whether a path exists', async () => {
    const filePath = join(dir, 'nested', 'file.txt');
    expect(await pathExists(filePath)).toBe(false);
    await atomicWriteFile(filePath, 'hello');
    expect(await pathExists(filePath)).toBe(true);
  });

  it('round-trips JSON via writeJsonFile/readJsonFile', async () => {
    const filePath = join(dir, 'data.json');
    await writeJsonFile(filePath, { a: 1, b: [1, 2, 3] });
    const value = await readJsonFile<{ a: number; b: number[] }>(filePath);
    expect(value).toEqual({ a: 1, b: [1, 2, 3] });
  });
});
