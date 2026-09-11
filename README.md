# CrewForge

**Build software with an AI engineering crew that lives in your repo.**

CrewForge turns GitHub Copilot into a persistent, repo-native team of specialized
engineering agents — Lead, Architect, Backend, Frontend, QA, Security, DevOps, and
Documentation — that plan, implement, and verify work together under your direction.

## The killer feature: team orchestration

Most AI coding tools give you one generic assistant:

```
User → AI
```

CrewForge gives you a coordinated team, delegated and supervised by a Lead:

```
                   ┌── Frontend Agent
                   │
                   ├── Backend Agent
User → Lead Agent ─┼── QA Agent
                   │
                   ├── Security Agent
                   │
                   └── DevOps Agent
```

The Lead breaks work into a task graph, hands each piece to the specialist best suited
for it, runs independent work in parallel, and reconciles the results — instead of one
model context-switching between every concern at once.

### Example: task decomposition

```
User:
Add Stripe subscriptions.

Lead:
I'll break this into:

1. Architecture
2. Database changes
3. Backend Stripe integration
4. Frontend subscription UI
5. Tests
6. Security review

Parallel work:
├── Backend
├── Frontend
└── Database

After implementation:
├── QA
└── Security

Final:
Lead reviews everything → human approval
```

## Demo

```
$ crewforge

You:
Build a user authentication system with Google OAuth.

CrewForge:

👨‍💻 Architect
   Designing authentication architecture...

⚙️ Backend
   Implementing OAuth endpoints...

🎨 Frontend
   Building login UI...

🧪 QA
   Creating authentication tests...

🔐 Security
   Reviewing OAuth implementation...

👑 Lead
   Coordinating changes and resolving conflicts...
```

Human decides → Lead coordinates → Specialists execute → Agents verify → Human approves.

> _The transcript above illustrates the target experience with a full team. The
> section below is the actual output of the CLI as it exists today._

<!-- TODO: replace with a recorded demo GIF/asciinema cast once the CLI is published. -->

## What you get

Running CrewForge against a project gives you:

- **A `.crewforge/` folder scaffolded into your repo** — team config, agent
  definitions, a knowledge base, an ADR log, task graph state, and session
  history. All plain Markdown/YAML/JSON, readable and diffable in git — nothing
  important lives only in a database.
- **A Lead agent that plans your request** — turns a plain-English task into a
  dependency-aware task graph, assigns each piece to Backend/Frontend/QA (or
  whichever agents you've configured), and runs independent branches in parallel.
- **Real Git awareness** — each agent's context includes the relevant diff, and
  if two agents touch the same files, CrewForge halts auto-merging and flags a
  conflict instead of silently discarding work.
- **Automatic verification** — your repo's own `test`/`lint`/`build` commands run
  after implementation; a failure demotes the run to `needs-review` and blocks
  approval.
- **A human approval gate on every run** — nothing is final until you approve
  it; you can also reject, retry, or ask for changes.
- **Opt-in git worktree isolation** — run each parallel task in its own git
  worktree and merge it back, with real git-level merge-conflict detection on
  top of the self-reported-file-list check.
- **MCP tool access** — connect agents to Model Context Protocol servers
  (`github`, `postgres`, `playwright`, or any custom command) declared in
  `team.yaml`.
- **A full CLI** (`init`, `run`, `ask`, `task`, `status`, `history`, `decisions`,
  `agents`, `mcp`, `doctor`) plus a built-in `MockRuntime`, so you can try the
  entire flow with zero AI credentials before pointing it at a real model — and
  a VS Code extension with the same views and commands inside the editor.

## Quick start

CrewForge isn't published to npm yet, so run it straight from a clone of this
repo. This repo _is_ the tool — you point its CLI at whichever project you want
the crew to work on.

```bash
git clone https://github.com/mohammadamer/CrewForge.git
cd CrewForge
npm install
npm run build
npm link --workspace packages/cli   # puts `crewforge` on your PATH, backed by this build
```

Then, from the project you actually want to work on (a separate git repo):

```bash
cd ~/projects/your-project
crewforge init                       # scaffolds .crewforge/ with Lead + Backend + Frontend + QA
crewforge run "Add a health check endpoint"
```

No permissions to `npm link` globally? Call the build directly instead:
`node /path/to/CrewForge/packages/cli/dist/bin/crewforge.js init`.

Real output from `crewforge init` followed by `crewforge run` (using the built-in
`MockRuntime`, so this works with zero AI credentials configured):

```
$ crewforge init
Initialized CrewForge in /repo/.crewforge
  created team.yaml
  created agents/lead.md
  created agents/backend.md
  created agents/frontend.md
  created agents/qa.md
  created knowledge/architecture.md
  created knowledge/conventions.md
  created knowledge/repository.md

$ crewforge run "Add a health check endpoint"
👑 lead starting...
✓ lead Mock agent completed the task.
⚙️ backend starting...
🎨 frontend starting...
✓ backend Mock agent completed the task.
✓ frontend Mock agent completed the task.
🧪 qa starting...
✓ qa Mock agent completed the task.

Files changed:
  (none)

4 completed, 0 failed, 0 need review
Approve changes? [y/N]
```

Set `CREWFORGE_MODEL_API_KEY` (or reuse `GITHUB_TOKEN`) to have `crewforge run`
call a real model instead of the mock runtime — see
[docs/architecture.md](docs/architecture.md#why-agentruntime-is-a-core-owned-interface).

Other commands: `crewforge status`, `crewforge history`, `crewforge decisions`,
`crewforge agents`, `crewforge mcp`, `crewforge ask <role> "<question>"`,
`crewforge doctor`. Run `crewforge --help` for the full list.

Prefer working inside the editor? See
[docs/development.md](docs/development.md#running-the-vs-code-extension) for how
to run the (not yet published) VS Code extension from this same clone — it has
Team/Tasks/Changed Files/Decisions views and a real Copilot-backed runtime via
`vscode.lm`.

## Configuration

Everything lives in human-readable files under `.crewforge/` — nothing important is
stored only in a database. The team is configured in `.crewforge/team.yaml`:

```yaml
name: my-project-team
lead: lead
agents: [lead, backend, frontend, qa]

workflow:
  planning: true
  parallel_execution: true
  verification: true
  human_approval: true
  worktrees: false # opt-in: isolate each parallel task in its own git worktree

verification:
  test: npm test
  lint: npm run lint
  build: npm run build

permissions:
  shell: restricted
  network: restricted
  filesystem: repository
  deployment: approval-required

mcp:
  servers:
    - github # shorthand for a known preset (github/postgres/playwright/filesystem)
```

See [docs/configuration.md](docs/configuration.md) for the full schema (including
per-agent Markdown definitions) and [docs/agents.md](docs/agents.md) for the
built-in role catalogue.

## Status / roadmap

The MVP described in build.md is implemented and tested end to end:

- ✅ Repo-native config, agent registry, repository detection
- ✅ Task graph, scheduler, Lead-driven planning (deterministic + AI-assisted)
- ✅ `MockRuntime` (default, no credentials needed) and `CopilotRuntime` (an
  OpenAI-compatible adapter — see [docs/architecture.md](docs/architecture.md) for
  why this is provisional)
- ✅ Full CLI (`init`, `run`, `ask`, `task`, `status`, `decisions`, `history`,
  `agents`, `doctor`)
- ✅ Real Git integration, verification runner, conflict detection, human approval
- ✅ Opt-in git worktree isolation for parallel tasks (`workflow.worktrees`), with
  real merge-conflict detection alongside the self-reported-file-list check
- ✅ MCP support (`mcp.servers` in `team.yaml`, connected via `@crewforge/integrations`'
  `McpClientProvider`, tools surfaced to agents as `AgentContext.availableTools`;
  see [docs/architecture.md](docs/architecture.md#mcp-model-context-protocol-support)
  for what's not wired up yet)
- ✅ VS Code extension (`packages/vscode`, not yet published — run it from source,
  see [docs/development.md](docs/development.md#running-the-vs-code-extension)):
  Team/Tasks/Changed Files/Decisions views, a `vscode.lm`-backed real Copilot
  runtime, all built on the same `@crewforge/cli` command functions the terminal
  CLI uses

Not yet built (see build.md's later phases): a generic declarative workflow
engine.

## Documentation

- [docs/architecture.md](docs/architecture.md) — how a run actually executes
- [docs/agents.md](docs/agents.md) — built-in roles
- [docs/workflows.md](docs/workflows.md) — the built-in step sequence
- [docs/configuration.md](docs/configuration.md) — `team.yaml` / agent schema
- [docs/development.md](docs/development.md) — building/testing this repo

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the dev
setup and workflow, and [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

[MIT](LICENSE)
