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

## Quick start

```bash
npm install -g @crewforge/cli   # or: npx @crewforge/cli <command>

cd your-project
crewforge init                  # scaffolds .crewforge/ with Lead + Backend + Frontend + QA
crewforge run "Add a health check endpoint"
```

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
`crewforge agents`, `crewforge ask <role> "<question>"`, `crewforge doctor`. Run
`crewforge --help` for the full list.

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

verification:
  test: npm test
  lint: npm run lint
  build: npm run build

permissions:
  shell: restricted
  network: restricted
  filesystem: repository
  deployment: approval-required
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

Not yet built (see build.md's later phases): Git worktree-isolated parallel
execution, MCP support, a generic declarative workflow engine, and the VS Code
extension.

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
