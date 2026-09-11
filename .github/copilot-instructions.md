# CrewForge — Copilot Instructions

CrewForge is a repo-native AI engineering team: a human developer delegates work to a
persistent team of specialized AI agents (Lead, Architect, Frontend, Backend, QA,
Security, DevOps, Documentation) coordinated by an orchestration engine, all driven
through GitHub Copilot as the execution layer.

**Status:** the repository currently contains only `README.md` and `LICENSE` — no code,
package manifests, or tooling exist yet. The architecture below is the target design to
build toward (see "Implementation strategy"). Do not assume any of these paths, files,
or commands exist until they have actually been created in a given session — check
before referencing them.

## Core philosophy (do not violate)

    Human decides → Lead coordinates → Specialists execute → Agents verify → Human approves

- CrewForge is an **orchestration layer**, not a wrapper around a single LLM call. The
  valuable IP is the Team → Lead → Task Graph → Specialized Agents → Shared Knowledge →
  Verification → Human Approval pipeline — keep it clean and extensible.
- The Lead plans/delegates/collects/reconciles; it must not silently execute everything
  itself.
- Human approval is a first-class, non-bypassable gate for anything risky (destructive
  commands, deleting files, prod deploys, DB migrations, security config changes,
  pushing to protected branches, merging PRs, adding credentials).
- Agents get explicit, scoped permissions and boundaries — never unrestricted access by
  default (see `permissions:` in `team.yaml`, e.g. `shell: restricted`,
  `filesystem: repository`, `deployment: approval-required`).

## Intended monorepo layout

```
packages/
  core/        # domain logic: agents, orchestration, tasks, context, memory,
               #   workflows, events, permissions, verification, git, config, shared
  runtime/     # AgentRuntime abstraction + implementations (copilot/, mock/)
  cli/         # `crewforge` CLI (commands/, ui/) — thin, no business logic
  vscode/      # VS Code extension (views/, panels/, commands/, providers/) — thin
  integrations/# mcp/, github/
  templates/   # agents/, workflows/
tests/
  unit/ integration/ fixtures/
docs/
.github/workflows/
```

TypeScript with strict config. **Business logic belongs in `packages/core` only** —
the CLI and VS Code UI are thin clients; `packages/core` must work standalone without
either. All external systems (Git, MCP, Copilot, other LLMs) are accessed through
interfaces defined in core, never called directly from CLI/UI code.

## Key abstractions to preserve

- `AgentRuntime` — `run(request): Promise<AgentResult>` / `stream(request): AsyncIterable<AgentEvent>`.
  Implement `CopilotRuntime` first and a `MockRuntime` for tests; leave room for
  `ClaudeRuntime` / `OpenAIRuntime` / `LocalRuntime` later. Never hard-code the Copilot
  SDK into orchestration logic.
- `GitProvider` — `status()/diff()/createBranch()/createWorktree()/commit()/merge()`.
- `ContextBuilder` — `build(task, agent, repository): AgentContext`. Each agent gets
  only the context it needs (task, relevant files, repo structure, agent instructions,
  relevant knowledge, prior decisions, dependent-agent results, relevant diff) — never
  the whole repo by default.
- `MCPProvider` — MCP servers are configured (`mcp.servers: [...]` in `team.yaml`), not
  hard-coded into core.
- Events: every agent execution emits structured `AgentEvent { id, taskId, agentId,
  timestamp, type, data }` (e.g. `AgentStarted`, `ToolCalled`, `FileChanged`,
  `TestCompleted`, `AgentCompleted`) — this is how UIs and history are built, so new
  agent actions should emit events rather than only returning a final result.

## Repo-native state (`.crewforge/`)

All important state is human-readable and version-controlled — Markdown/YAML/JSON, no
opaque databases for state that matters.

```
.crewforge/
  team.yaml               # team composition, workflow toggles, verification commands, permissions, mcp
  agents/*.md             # one file per agent: role, responsibilities, constraints, knowledge links
  knowledge/
    architecture.md
    conventions.md
    decisions.md          # running log of Architecture Decision Records — shared, persistent
  tasks/
    current/              # active task graph state
  history/
    decisions/             # archived/superseded ADRs moved out of knowledge/decisions.md
```

- Agents should consult `knowledge/decisions.md` before proposing architectural changes
  and append new decisions there (Decision/Context/Alternatives/Consequences/Date/Author);
  superseded decisions move to `history/decisions/`.
- Agent memory (if added under `agents/<role>/memory.md`) must stay inspectable,
  editable, and concise — summarize, never accumulate an unbounded transcript.
- `team.yaml` `verification:` (e.g. `test: npm test`, `lint: npm run lint`,
  `build: npm run build`) defines the commands QA/CI should run; prefer this explicit
  config over auto-discovery when both are possible.

## Conventions

- Tasks carry `id, title, description, owner, dependencies, status, createdAt,
  startedAt, completedAt, artifacts, result, errors`; statuses are `pending → planning →
  ready → running → blocked → completed → failed → needs-review → approved`.
- Independent tasks (e.g. Backend/Frontend) may run in parallel; anything depending on
  both (Integration, QA, Security) must wait — respect the dependency graph, don't
  special-case scheduling in individual agents.
- When agents touch overlapping files: detect the overlap, stop automatic merging,
  escalate to the Lead for a suggested resolution, and require human approval for
  anything non-trivial. Never silently discard another agent's changes.
- Use dependency injection and interfaces around every external system; avoid adding
  dependencies without justification.

## Build order (MVP first)

Do not build later phases before earlier ones are stable and tested:

1. Monorepo + TypeScript + core domain models + config + agent registry
2. Task model, task graph, orchestration engine, Lead agent
3. `CopilotRuntime` + `MockRuntime` + agent execution
4. CLI: `init`, `run`, `status`, `history`
5. Git integration, verification, human approval
6. Parallel execution / work isolation
7. MCP support
8. VS Code extension

MVP scope is: `crewforge init`, repo detection, agent config, Lead + 3 specialists
(Backend/Frontend/QA), task decomposition, sequential + basic parallel execution,
persistent task state, git diff awareness, human approval, verification, and a
`MockRuntime` so tests never require live AI calls.

## Testing

Use a `MockAgentRuntime`/`MockRuntime` for all unit and integration tests — no test
should require a real Copilot/LLM call. Cover: task planner, dependency graph,
scheduler, context builder, permissions, agent registry, workflow engine, memory, event
system (unit) and full multi-agent workflows, parallel tasks, agent failure/retry,
approval flow, git conflicts, and verification failure (integration).

At the end of each implementation phase: run tests, type-check, lint, and build, and
fix errors before moving to the next phase. (Exact commands will depend on the package
manager/scripts chosen when the monorepo is scaffolded — check `package.json` scripts
once they exist rather than assuming `npm test`/`npm run lint`/`npm run build`.)
