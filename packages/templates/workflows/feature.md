# Feature workflow (reference)

This describes CrewForge's built-in sequence for a typical feature request. It is
not yet a configurable, declarative workflow engine (see build.md's CUSTOM WORKFLOWS
section) \u2014 that generic engine is planned for a later phase. Today, the Lead follows
this fixed sequence internally.

1. `lead.plan` \u2014 understand the request, inspect the repository, produce a task graph.
2. `architect.review` \u2014 optional, when the change affects shared architecture.
3. `backend.implement` / `frontend.implement` \u2014 run in parallel when independent.
4. `lead.integrate` \u2014 reconcile results, detect file-overlap conflicts.
5. `qa.verify` \u2014 run tests, lint, and build; report pass/fail.
6. `security.review` \u2014 when the change touches auth, secrets, or external input.
7. `lead.final-review` \u2014 summarize changes and route to human approval.
