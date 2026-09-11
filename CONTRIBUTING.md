# Contributing to CrewForge

Thanks for your interest in contributing. CrewForge is being built incrementally,
phase by phase (see `.github/build.md` and `.github/copilot-instructions.md`) \u2014
please check which phase is currently in progress before proposing large changes.

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- npm (this repo uses npm workspaces, not pnpm/yarn)

## Getting started

```bash
npm install
npm run build
npm test
```

## Project layout

This is an npm-workspaces monorepo using TypeScript project references:

```
packages/
  core/        # domain logic only \u2014 no CLI/UI code, no concrete AI runtime
  runtime/     # AgentRuntime abstraction + implementations (added in a later phase)
  cli/         # `crewforge` CLI (added in a later phase)
  templates/   # built-in agent + workflow reference templates
tests/
  unit/        # fast, no I/O beyond temp dirs and fixtures
  integration/ # end-to-end flows (added in a later phase)
  fixtures/    # static fixture repos/configs used by tests
```

`packages/core` must keep working standalone, with zero dependency on the CLI,
a VS Code extension, or any concrete AI runtime. All external systems (Git, MCP,
AI runtimes) are accessed through interfaces defined in `packages/core`.

## Scripts

| Command                     | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `npm run build`             | `tsc -b` across all workspace packages             |
| `npm run lint` / `lint:fix` | ESLint across the repo                             |
| `npm run format:check`      | Prettier check (`format` to write)                 |
| `npm test`                  | Unit tests (Vitest, `tests/unit/**`)               |
| `npm run test:integration`  | Integration tests (Vitest, `tests/integration/**`) |
| `npm run typecheck`         | Force a full, non-incremental type check           |

Run all of build/lint/format/test before opening a PR \u2014 CI runs the same checks.

## Conventions

- TypeScript, strict mode, ESM (`NodeNext` module resolution).
- No business logic in `packages/cli` or `packages/vscode` \u2014 they are thin clients
  over `packages/core`.
- Every external system gets an interface in `packages/core` (e.g. `GitProvider`,
  `AgentRuntime`, `VerificationRunner`) with a `Mock`-style implementation usable in
  tests; avoid adding a dependency without a comment/PR description explaining why.
- Prefer Node's built-in APIs (`node:fs`, `node:child_process`, `fetch`, ...) over
  adding a package for something the standard library already does well.

## Branching / PRs

- Small, reviewable PRs scoped to a single phase/feature where possible.
- Include or update tests for any behavior change.
- Describe which build phase (per `.github/copilot-instructions.md`) the PR advances.
