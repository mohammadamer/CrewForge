# Configuration reference

CrewForge's state lives entirely in human-readable files under `.crewforge/` in
your repository. This page documents the two schemas that back it: `team.yaml`
and per-agent Markdown definitions.

## `team.yaml`

```yaml
name: my-project-team

lead: lead

agents:
  - lead
  - backend
  - frontend
  - qa

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

mcp:
  servers: []
```

| Field                          | Type                                            | Default               | Notes                                                               |
| ------------------------------ | ----------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| `name`                         | `string`                                        | required              | Human-readable name for this team.                                  |
| `lead`                         | `string`                                        | `"lead"`              | Role id of the agent that acts as Lead.                             |
| `agents`                       | `string[]`                                      | required, min 1       | Roles active for this project (must have a matching `agents/*.md`). |
| `workflow.planning`            | `boolean`                                       | `true`                | Whether the Lead plans before delegating.                           |
| `workflow.parallel_execution`  | `boolean`                                       | `true`                | Whether independent tasks may run concurrently.                     |
| `workflow.verification`        | `boolean`                                       | `true`                | Whether QA verification runs before final approval.                 |
| `workflow.human_approval`      | `boolean`                                       | `true`                | Whether a final human approval gate is required.                    |
| `verification.test/lint/build` | `string`                                        | none                  | Shell commands run during verification (Phase 5).                   |
| `permissions.shell`            | `"none" \| "restricted" \| "full"`              | `"restricted"`        | Team-wide default; agents may narrow via their own frontmatter.     |
| `permissions.network`          | `"none" \| "restricted" \| "full"`              | `"restricted"`        |                                                                     |
| `permissions.filesystem`       | `"repository" \| "readonly"`                    | `"repository"`        |                                                                     |
| `permissions.deployment`       | `"blocked" \| "approval-required" \| "allowed"` | `"approval-required"` |                                                                     |
| `mcp.servers`                  | `string[]`                                      | `[]`                  | Named MCP servers to make available to agents (later phase).        |

Validated by `teamConfigSchema` in `packages/core/src/config/team-config-schema.ts`.

## Agent definitions (`.crewforge/agents/<role>.md`)

Each agent is a Markdown file with YAML frontmatter followed by free-form
instructions (the agent's system prompt):

```markdown
---
role: backend
displayName: Backend Engineer
responsibilities:
  - API implementation
  - Business logic
  - Database integration
  - Backend testing
constraints:
  - Do not modify frontend code
  - Follow repository architecture
  - Do not introduce dependencies without justification
knowledge:
  - ../knowledge/architecture.md
  - ../knowledge/conventions.md
permissions:
  shell: restricted
---

# Backend Engineer

Free-form instructions for this agent go here.
```

| Frontmatter field  | Type                      | Required | Notes                                                                                                                                          |
| ------------------ | ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`             | `string`                  | yes      | Unique id; must match an entry in `team.yaml`'s `agents` list.                                                                                 |
| `displayName`      | `string`                  | no       | Defaults to `role` if omitted.                                                                                                                 |
| `responsibilities` | `string[]`, min 1         | yes      | What this agent is expected to do.                                                                                                             |
| `constraints`      | `string[]`, min 1         | yes      | Explicit boundaries \u2014 every agent must have at least one.                                                                                 |
| `knowledge`        | `string[]`                | no       | Paths to knowledge files, relative to this file's own directory. Every path must resolve to an existing file or the agent registry rejects it. |
| `permissions`      | partial permission policy | no       | Overrides the team-wide `permissions` for this agent only.                                                                                     |

Validated by `agentFrontmatterSchema` in
`packages/core/src/config/agent-definition-schema.ts` and enforced (including
knowledge-file existence) by `AgentRegistry`.
