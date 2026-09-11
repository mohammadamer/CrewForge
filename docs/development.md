# Development guide

## Setup

```bash
nvm use        # or ensure Node.js >= 22 is active
npm install
npm run build
```

## Everyday commands

```bash
npm run build            # tsc -b, respects TS project references
npm run lint              # eslint .
npm run format            # prettier --write .
npm test                  # vitest run --config vitest.config.ts   (tests/unit/**)
npm run test:integration  # vitest run --config vitest.integration.config.ts
npm run test:watch        # vitest in watch mode
```

Run `npm run build && npm run lint && npm run format:check && npm test && npm run test:integration`
(what CI runs) before opening a PR.

## How the monorepo fits together

- **npm workspaces** (`packages/*`) hoist shared dependencies to the root
  `node_modules` and symlink workspace packages into each other's `node_modules`.
- **TypeScript project references**: the root `tsconfig.json` lists `references` to
  each buildable package; `tsc -b` builds them in dependency order and only
  rebuilds what changed (`.tsbuildinfo` caches).
- **Tests run against source, not `dist/`.** `vitest.config.ts` aliases
  `@crewforge/core` (and future workspace packages) directly to their
  `src/index.ts`, so `npm test` never requires a prior build step. Published/
  runtime consumption (the CLI binary, `npm install`'d packages) uses the compiled
  `dist/` output declared in each package's `exports` field.

## Adding a new workspace package

1. `packages/<name>/package.json` (name it `@crewforge/<name>`), extending the root
   `tsconfig.base.json` from `packages/<name>/tsconfig.json`.
2. Add a `{ "path": "packages/<name>" }` reference to the root `tsconfig.json`.
3. If other packages need to import it in tests, add an alias in
   `vitest.config.ts`/`vitest.integration.config.ts` pointing at its `src/index.ts`.

## Testing philosophy

- Unit tests (`tests/unit/**`) should not require network access or a live AI
  runtime \u2014 use `MockRuntime` (added once `@crewforge/runtime` exists) and temp
  directories (`node:fs/promises` `mkdtemp`) for anything touching the filesystem.
- Integration tests (`tests/integration/**`) exercise multi-component flows (e.g. a
  full `crewforge run` with the mock runtime) and may be slower; they get a longer
  Vitest timeout.
- Static fixtures live under `tests/fixtures/` (e.g. a full sample `.crewforge/`
  directory) rather than being generated inline, so they're easy to inspect and reuse.
