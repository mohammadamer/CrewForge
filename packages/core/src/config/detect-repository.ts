import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '../shared/fs-utils.js';
import type { RepositorySummary } from '../context/types.js';

const IGNORED_ENTRIES = new Set(['node_modules', '.git', 'dist', 'coverage', '.crewforge']);

interface MinimalPackageJson {
  main?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
}

/** Lightweight, heuristic repository detection used to seed `.crewforge/knowledge/repository.md`. */
export async function detectRepository(rootPath: string): Promise<RepositorySummary> {
  const packageJsonPath = join(rootPath, 'package.json');

  let language: string | undefined;
  let packageManager: string | undefined;
  const entryPoints: string[] = [];
  let hasTests = false;
  let hasLint = false;
  let hasBuild = false;

  if (await pathExists(packageJsonPath)) {
    language = 'javascript-typescript';
    const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8')) as MinimalPackageJson;

    if (pkg.main) entryPoints.push(pkg.main);
    if (typeof pkg.bin === 'string') entryPoints.push(pkg.bin);
    else if (pkg.bin) entryPoints.push(...Object.values(pkg.bin));

    hasTests = Boolean(pkg.scripts?.test);
    hasLint = Boolean(pkg.scripts?.lint);
    hasBuild = Boolean(pkg.scripts?.build);

    if (await pathExists(join(rootPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
    else if (await pathExists(join(rootPath, 'yarn.lock'))) packageManager = 'yarn';
    else if (await pathExists(join(rootPath, 'package-lock.json'))) packageManager = 'npm';
  } else if (await pathExists(join(rootPath, 'pyproject.toml'))) {
    language = 'python';
  } else if (await pathExists(join(rootPath, 'go.mod'))) {
    language = 'go';
  } else if (await pathExists(join(rootPath, 'Cargo.toml'))) {
    language = 'rust';
  }

  return {
    rootPath,
    language,
    packageManager,
    hasTests,
    hasLint,
    hasBuild,
    entryPoints,
    structure: await listTopLevel(rootPath),
  };
}

async function listTopLevel(rootPath: string): Promise<string[]> {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });
    return entries
      .filter((entry) => !IGNORED_ENTRIES.has(entry.name) && !entry.name.startsWith('.'))
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort();
  } catch {
    return [];
  }
}
