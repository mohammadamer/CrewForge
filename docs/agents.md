# Built-in agents

CrewForge ships Markdown templates for eight engineering roles in
`packages/templates/agents/`. `crewforge init` (added in a later phase) activates
a subset by default; the rest are available on request.

| Role            | Activated by default | Responsibilities (summary)                                     |
| --------------- | :------------------: | -------------------------------------------------------------- |
| `lead`          |        \u2705        | Plans, delegates, reconciles conflicts, gates human approval   |
| `backend`       |        \u2705        | APIs, business logic, database integration, backend tests      |
| `frontend`      |        \u2705        | UI implementation, client state, accessibility, frontend tests |
| `qa`            |        \u2705        | Tests, runs verification commands, reports pass/fail           |
| `architect`     |                      | Architecture design/review, records ADRs                       |
| `security`      |                      | OWASP-style review, flags destructive/unsafe changes           |
| `devops`        |                      | CI/CD, build tooling, infrastructure-as-code                   |
| `documentation` |                      | Keeps README/docs in sync with shipped changes                 |

The default set (`lead`, `backend`, `frontend`, `qa`) matches CrewForge's MVP scope;
the remaining four are full templates you can add to your team as soon as you need
them.

## Anatomy of an agent definition

Every agent is a single Markdown file: YAML frontmatter (role, responsibilities,
constraints, knowledge references, optional permission overrides) followed by
free-form instructions used as that agent's system prompt. See
[configuration.md](configuration.md) for the full field reference.

## Design principles

- **Explicit boundaries.** Every built-in agent has at least one `constraints`
  entry describing what it must _not_ do (e.g. Backend must not touch frontend
  code; Security may only recommend, never approve, a fix itself).
- **Scoped knowledge.** Agents only reference the knowledge files relevant to their
  role, not the entire `.crewforge/knowledge/` directory.
- **No unrestricted permissions.** `security` and `devops` narrow their permissions
  below the team default (e.g. `deployment: blocked` for Security) rather than
  inheriting broad access.

## Custom agents

You can add your own role by creating `.crewforge/agents/<role>.md` following the
same schema, and adding `<role>` to `team.yaml`'s `agents` list. A `crewforge agent
create <role>` command that scaffolds this for you is planned for the CLI phase.
