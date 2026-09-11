# Security Policy

## Supported versions

CrewForge is pre-1.0 and under active development. Only the latest commit on
`main` is supported; there are no maintained release branches yet.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately via [GitHub Security Advisories](../../security/advisories/new)
for this repository. Include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce (a minimal repro is ideal).
- Any relevant logs, versions, or configuration.

We'll acknowledge reports as soon as possible and work with you on a fix and
coordinated disclosure timeline.

## Scope notes specific to CrewForge

CrewForge orchestrates AI agents that can execute shell commands, modify files, and
call external services on a developer's behalf. Security-relevant areas we care
about most:

- Bypassing human-approval gates for destructive actions (file deletion, force
  pushes, deployments, migrations, credential/secret writes).
- Privilege escalation beyond an agent's configured `permissions` policy.
- Secret/credential leakage into logs, events, or `.crewforge/` state files.
- Path traversal or arbitrary file access outside the repository root.
