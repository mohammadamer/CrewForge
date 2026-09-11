# Workflows

build.md describes a generic, declarative workflow engine — teams define arbitrary
sequences like:

```yaml
workflows:
  feature:
    - lead.plan
    - architect.review
    - backend.implement
    - frontend.implement
    - qa.verify
    - security.review
    - lead.final-review
```

That generic engine (parsing `workflows:` from `team.yaml`, running arbitrary
user-defined sequences, mixing custom step types) is explicitly a **post-MVP**
feature. It is not implemented yet.

## What ships today: one built-in workflow

CrewForge currently follows a single, fixed sequence for every `crewforge run`,
described declaratively as data in `packages/core/src/workflows/default-workflow.ts`
(`FEATURE_WORKFLOW`) so the shape is documented and stable, even though nothing yet
interprets that data generically:

| Step                 | Role       | What actually implements it today                                                                                                            |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `lead.plan`          | `lead`     | `TaskPlanner` (`AiTaskPlanner`, falling back to `DeterministicTaskPlanner`)                                                                  |
| `backend.implement`  | `backend`  | `Scheduler` + `AgentExecutor`, run in parallel with `frontend.implement`                                                                     |
| `frontend.implement` | `frontend` | `Scheduler` + `AgentExecutor`, run in parallel with `backend.implement`                                                                      |
| `lead.integrate`     | `lead`     | `detectConflicts()` in `run-orchestrator.ts`, demotes overlapping tasks                                                                      |
| `qa.verify`          | `qa`       | The `qa`-owned task (an agent call) **and**, separately, the real `CommandVerificationRunner` stage (`test`/`lint`/`build` from `team.yaml`) |
| `security.review`    | `security` | A normal task, only if `security` is in `team.yaml`'s `agents` list                                                                          |
| `lead.final-review`  | `lead`     | The CLI's final summary + `Approve changes?` prompt, gated by `workflow.human_approval`                                                      |

In other words: the _sequence_ is fixed and matches the table above, but each step
is implemented directly by a purpose-built component (planner, scheduler, conflict
detector, verification runner, approval prompt) rather than by an engine walking a
list of steps. This keeps the MVP simple while leaving the shape build.md describes
intact for a future engine to grow into.

## Parallelism

Only `TaskGraph` dependency edges determine what runs concurrently — there's no
separate "parallel" concept. The default planner makes `backend`/`frontend` tasks
depend only on the planning task (so they're both ready at the same time) and makes
`qa` depend on all implementation tasks (so it waits for both). `Scheduler` executes
every currently-ready batch concurrently, bounded by a configurable concurrency
limit; `team.yaml`'s `workflow.parallel_execution: false` would need the planner to
stop branching (not yet wired — today the planner always produces the parallel
shape when both roles are present).

## What a future declarative engine would need

- Parse `workflows:` from `team.yaml` into `Workflow`/`WorkflowStep` values (the
  types already exist in `core/workflows/types.ts`).
- Replace `TaskPlanner`'s hardcoded shape with one derived from the selected
  `Workflow`'s steps and `parallelGroup`s.
- Let `crewforge run` accept `--workflow <name>` to pick a workflow other than the
  default.

None of this is implemented yet; `FEATURE_WORKFLOW` is the only workflow, and it is
not user-overridable.
