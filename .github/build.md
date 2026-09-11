You are a senior staff software engineer and product architect.

Build a production-quality open-source developer tool called "CrewForge".

CrewForge is a repo-native AI engineering team that allows a human developer to work with a persistent team of specialized AI agents through GitHub Copilot.

The product should be inspired by the concept of persistent AI development teams, but it must have its own architecture, UX, naming, implementation, and feature set.

==================================================
PRODUCT VISION
==================================================

CrewForge gives developers a human-directed AI engineering team that lives inside their Git repository.

Instead of interacting with one generic coding assistant, developers can delegate work to specialized engineering roles such as:

- Lead Engineer
- Software Architect
- Frontend Engineer
- Backend Engineer
- QA Engineer
- Security Engineer
- DevOps Engineer
- Documentation Engineer

Each agent has:

- Its own role
- Its own system instructions
- Its own context
- Its own persistent knowledge
- Its own responsibilities
- Access to relevant repository information
- The ability to produce artifacts and implementation changes

The human remains the decision-maker.

CrewForge must NOT attempt to autonomously replace engineers.

The core philosophy is:

Human decides.
Lead coordinates.
Specialists execute.
Agents verify.
Human approves.

==================================================
CORE USER EXPERIENCE
==================================================

The developer should be able to install CrewForge and initialize a team:

    crewforge init

This creates:

    .crewforge/
        team.yaml
        agents/
        knowledge/
        tasks/
        decisions/
        sessions/

Example:

    .crewforge/
    ├── team.yaml
    ├── agents/
    │   ├── lead.md
    │   ├── architect.md
    │   ├── frontend.md
    │   ├── backend.md
    │   ├── qa.md
    │   └── security.md
    ├── knowledge/
    │   ├── architecture.md
    │   ├── conventions.md
    │   └── repository.md
    ├── tasks/
    ├── decisions/
    └── sessions/

All files must be human-readable Markdown/YAML/JSON.

Avoid storing important state exclusively in a database.

The repository should remain inspectable and version-controllable.

==================================================
CLI
==================================================

Build a CLI called:

    crewforge

Commands:

    crewforge init
    crewforge team
    crewforge agents
    crewforge run
    crewforge ask
    crewforge task
    crewforge status
    crewforge decisions
    crewforge history
    crewforge doctor

Examples:

    crewforge init

    crewforge team

    crewforge run "Add passwordless authentication"

    crewforge ask backend "Review our API architecture"

    crewforge task create "Implement user profile API"

    crewforge status

    crewforge decisions

==================================================
TEAM CONFIGURATION
==================================================

team.yaml should allow developers to define their team.

Example:

    name: my-project-team

    lead: lead

    agents:
      - architect
      - frontend
      - backend
      - qa
      - security

    workflow:
      planning: true
      parallel_execution: true
      verification: true
      human_approval: true

Agents should be configurable.

==================================================
AGENT DEFINITION
==================================================

Each agent should be represented by a Markdown file.

Example:

    .crewforge/agents/backend.md

The file should define:

    # Backend Engineer

    role: backend

    responsibilities:
    - API implementation
    - business logic
    - database integration
    - backend testing

    constraints:
    - Do not modify frontend code
    - Follow repository architecture
    - Do not introduce dependencies without justification

    knowledge:
    - ../knowledge/architecture.md
    - ../knowledge/conventions.md

Agents should have explicit boundaries.

Do not give every agent unrestricted access to every task.

==================================================
LEAD AGENT
==================================================

The Lead is responsible for orchestration.

When the developer gives a task:

    crewforge run "Add Stripe subscriptions"

The Lead should:

1. Understand the request.
2. Inspect the repository.
3. Determine affected areas.
4. Break the task into subtasks.
5. Select appropriate specialists.
6. Identify dependencies.
7. Decide which tasks can execute in parallel.
8. Delegate work.
9. Collect results.
10. Detect conflicts.
11. Request additional work if necessary.
12. Ask QA to verify.
13. Ask Security to review when relevant.
14. Produce a final summary.
15. Require human approval before risky/final actions.

The Lead should NOT blindly execute everything itself.

==================================================
TASK GRAPH
==================================================

Represent complex work as a task graph.

Example:

    Authentication
          |
       Planning
      /        \
 Backend      Frontend
      \        /
       Integration
           |
          QA
           |
       Security
           |
      Human Review

Tasks should support:

- id
- title
- description
- owner
- dependencies
- status
- createdAt
- startedAt
- completedAt
- artifacts
- result
- errors

Statuses:

    pending
    planning
    ready
    running
    blocked
    completed
    failed
    needs-review
    approved

==================================================
PARALLEL EXECUTION
==================================================

If tasks have no dependencies, allow them to run concurrently.

Example:

Backend and Frontend can work simultaneously.

However:

Integration must wait until both are completed.

QA must wait until implementation is available.

Security review should happen after implementation.

The orchestration engine must understand dependencies.

==================================================
CONTEXT MANAGEMENT
==================================================

Context is one of the most important parts of CrewForge.

Each agent should receive only the context necessary for its task.

Context can include:

- User request
- Task description
- Relevant files
- Repository structure
- Agent instructions
- Relevant knowledge
- Previous decisions
- Results from dependent agents
- Relevant git diff

Avoid blindly sending the entire repository to every agent.

Create a ContextBuilder abstraction.

Example:

    interface ContextBuilder {
      build(task, agent, repository): AgentContext
    }

This should be replaceable.

==================================================
PERSISTENT KNOWLEDGE
==================================================

Agents should learn from work without creating an opaque memory system.

Important knowledge should be written to files.

Examples:

    .crewforge/knowledge/architecture.md

    .crewforge/knowledge/conventions.md

    .crewforge/knowledge/repository.md

Decisions should be recorded as Architecture Decision Records.

Example:

    .crewforge/decisions/ADR-001-database-choice.md

An ADR should include:

- Decision
- Context
- Alternatives
- Consequences
- Date
- Author/agent

Agents should be encouraged to consult existing decisions before proposing architectural changes.

==================================================
AGENT MEMORY
==================================================

Each agent may maintain role-specific knowledge.

For example:

    .crewforge/agents/backend/
        memory.md

But memory must be:

- inspectable
- editable
- version-controlled
- scoped
- concise

Do not create an unlimited conversation transcript as memory.

Implement memory summarization.

==================================================
GITHUB COPILOT INTEGRATION
==================================================

Use the GitHub Copilot SDK as the primary AI execution layer.

Do not tightly couple the orchestration engine to the Copilot implementation.

Create an abstraction:

    interface AgentRuntime {
      run(request: AgentRequest): Promise<AgentResult>
      stream(request: AgentRequest): AsyncIterable<AgentEvent>
    }

Implement:

    CopilotRuntime

Architecture should allow future runtimes:

    ClaudeRuntime
    OpenAIRuntime
    LocalRuntime
    MockRuntime

Do not assume that CrewForge owns or implements an LLM.

CrewForge is an orchestration layer.

==================================================
AGENT EVENTS
==================================================

Every agent execution should produce structured events.

Examples:

    AgentStarted
    AgentThinking
    ToolCalled
    FileRead
    FileChanged
    CommandExecuted
    TestStarted
    TestCompleted
    AgentMessage
    AgentCompleted
    AgentFailed

Use an event-driven architecture.

Example:

    AgentEvent {
      id
      taskId
      agentId
      timestamp
      type
      data
    }

This will allow future UIs to visualize execution.

==================================================
HUMAN-IN-THE-LOOP
==================================================

Human approval is a first-class concept.

CrewForge should never silently perform dangerous actions.

Require approval for:

- deleting files
- destructive commands
- production deployments
- database migrations
- changing security configuration
- adding sensitive credentials
- pushing to protected branches
- merging pull requests

Support:

    approve
    reject
    modify
    retry

The user should always be able to inspect what the agents are doing.

==================================================
GIT INTEGRATION
==================================================

Use Git extensively.

The system should understand:

- branch
- commit
- diff
- changed files
- worktree
- status

For parallel tasks, consider isolated Git worktrees.

Example:

    .crewforge/worktrees/
        task-backend/
        task-frontend/

Agents should avoid overwriting each other's work.

Create a Git abstraction:

    interface GitProvider {
      status()
      diff()
      createBranch()
      createWorktree()
      commit()
      merge()
    }

==================================================
CONFLICT MANAGEMENT
==================================================

When multiple agents modify overlapping files:

1. Detect overlap.
2. Stop automatic merging.
3. Notify Lead.
4. Ask Lead to analyze the conflict.
5. Produce a suggested resolution.
6. Require human approval for difficult conflicts.

Never silently discard another agent's changes.

==================================================
VERIFICATION
==================================================

CrewForge should have a verification stage.

After implementation:

QA should inspect:

- unit tests
- integration tests
- type checking
- linting
- build
- relevant runtime behavior

The repository should define verification commands.

Example:

    .crewforge/team.yaml

    verification:
      test: npm test
      lint: npm run lint
      build: npm run build

CrewForge should automatically discover commands where possible but prefer explicit configuration.

==================================================
SECURITY
==================================================

Security must be built into the architecture.

Implement:

- command permission policies
- file access policies
- agent capability restrictions
- secret detection
- destructive command detection
- protected file detection
- approval gates

Example:

    permissions:
      shell: restricted
      network: restricted
      filesystem: repository
      deployment: approval-required

Agents must not receive unlimited permissions by default.

==================================================
MCP SUPPORT
==================================================

Support Model Context Protocol through an abstraction.

Agents should be able to use MCP tools when configured.

Example:

    mcp:
      servers:
        - github
        - postgres
        - playwright

Do not hard-code individual MCP implementations into the core.

Create:

    MCPProvider

and adapters.

==================================================
AGENT SPECIALIZATION
==================================================

Include built-in agent templates:

1. Lead Engineer
2. Architect
3. Frontend Engineer
4. Backend Engineer
5. QA Engineer
6. Security Engineer
7. DevOps Engineer
8. Documentation Engineer

Users should be able to create custom agents.

Example:

    crewforge agent create database

This should generate a customizable Markdown definition.

==================================================
CUSTOM WORKFLOWS
==================================================

Allow teams to define workflows.

Example:

    workflows:
      feature:
        - lead.plan
        - architect.review
        - backend.implement
        - frontend.implement
        - qa.verify
        - security.review
        - lead.final-review

Another:

    workflows:
      bugfix:
        - lead.analyze
        - backend.fix
        - qa.verify
        - lead.review

The workflow engine must be generic.

==================================================
PLUGIN ARCHITECTURE
==================================================

Design CrewForge to be extensible.

Potential extension points:

- Agent runtimes
- Agent roles
- Git providers
- MCP providers
- Workflow providers
- Context providers
- Verification providers
- UI clients
- Notification providers

Use interfaces and dependency injection.

Avoid tightly coupled implementations.

==================================================
WEB / VS CODE UI
==================================================

After the CLI foundation is working, build a VS Code extension.

The extension should provide:

- Team panel
- Agent list
- Active tasks
- Task graph
- Agent activity
- Changed files
- Git diff
- Verification status
- Approval requests
- Decisions
- Agent logs

Example:

    CREWFORGE

    👑 Lead
       Coordinating

    ⚙ Backend
       Implementing API

    🎨 Frontend
       Building UI

    🧪 QA
       Waiting

    🔐 Security
       Waiting

    ------------------

    TASK
    Add user authentication

    ✓ Architecture
    ✓ Backend
    ● Frontend
    ○ QA
    ○ Security

The UI should make agent activity understandable without overwhelming the developer.

==================================================
PROJECT STRUCTURE
==================================================

Use a monorepo.

Recommended structure:

    packages/
      core/
        src/
          agents/
          orchestration/
          tasks/
          context/
          memory/
          workflows/
          events/
          permissions/
          verification/
          git/
          config/
          shared/

      runtime/
        src/
          runtime.ts
          copilot/
          mock/

      cli/
        src/
          commands/
          ui/

      vscode/
        src/
          views/
          panels/
          commands/
          providers/

      integrations/
        src/
          mcp/
          github/

      templates/
        agents/
        workflows/

    tests/
      unit/
      integration/
      fixtures/

    docs/

    .github/
      workflows/

Use TypeScript.

Use strict TypeScript configuration.

==================================================
ARCHITECTURAL PRINCIPLES
==================================================

Follow these principles:

1. Human-first
2. Repository-native
3. Provider-agnostic
4. Agent-runtime agnostic
5. Event-driven
6. Explicit permissions
7. Persistent inspectable state
8. Modular architecture
9. Testable components
10. No hidden state
11. No magic orchestration
12. Safe defaults
13. Extensible plugin system

Do not put business logic inside CLI commands.

Do not put business logic inside VS Code UI.

The core orchestration engine must work without the CLI or VS Code extension.

==================================================
MVP
==================================================

Do NOT implement everything at once.

Build the MVP first.

MVP features:

1. crewforge init
2. Repository detection
3. Agent configuration
4. Lead agent
5. 3 built-in specialists:
   - Backend
   - Frontend
   - QA
6. Task decomposition
7. Sequential execution
8. Basic parallel execution
9. Persistent task state
10. Agent results
11. Git diff awareness
12. Human approval
13. Verification
14. Copilot runtime abstraction
15. Mock runtime for testing

Only after the MVP works should you implement:

- VS Code extension
- MCP
- Git worktrees
- advanced memory
- plugin system
- advanced workflows
- GitHub integration

==================================================
DEVELOPER EXPERIENCE
==================================================

The first-run experience should be extremely simple.

Example:

    npx crewforge init

Then:

    crewforge run "Build a REST API for managing projects"

The user should immediately see:

    CrewForge

    👑 Lead
    Planning task...

    ⚙ Backend
    Implementing project API...

    🧪 QA
    Preparing tests...

    ✓ Backend completed
    ✓ Tests passed

    Human approval required.

    Files changed:
      src/projects/project.service.ts
      src/projects/project.controller.ts
      src/projects/project.test.ts

    Approve changes? [y/N]

The product should feel polished and developer-friendly.

==================================================
OBSERVABILITY
==================================================

Every run should be inspectable.

Example:

    crewforge history

    Run #42
    "Add authentication"

    Duration: 8m 32s

    Agents:
      Lead       1
      Architect  1
      Backend    3
      Frontend   2
      QA         4
      Security   1

    Files changed: 17
    Tests: 42
    Passed: 42

Allow:

    crewforge history 42

to inspect the full execution.

==================================================
TESTING
==================================================

Create comprehensive tests.

Unit test:

- task planner
- dependency graph
- scheduler
- context builder
- permissions
- agent registry
- workflow engine
- memory
- event system

Integration test:

- complete feature workflow
- multiple agents
- parallel tasks
- failed agent
- retry
- approval
- Git conflict
- verification failure

Create a MockAgentRuntime so tests never require real AI calls.

==================================================
DOCUMENTATION
==================================================

Create:

README.md
CONTRIBUTING.md
SECURITY.md
LICENSE
docs/architecture.md
docs/agents.md
docs/workflows.md
docs/configuration.md
docs/development.md

README must contain:

- compelling one-line description
- problem statement
- architecture diagram
- quick start
- demo workflow
- configuration example
- screenshots/GIF placeholder
- roadmap
- contribution instructions

==================================================
IMPLEMENTATION STRATEGY
==================================================

Do not generate a giant codebase in one step.

Work incrementally.

Phase 1:
- repository setup
- monorepo
- TypeScript
- core domain models
- configuration
- agent registry

Phase 2:
- task model
- task graph
- orchestration engine
- Lead agent

Phase 3:
- Copilot runtime abstraction
- Mock runtime
- agent execution

Phase 4:
- CLI
- init
- run
- status
- history

Phase 5:
- Git integration
- verification
- approval system

Phase 6:
- parallel execution
- work isolation

Phase 7:
- MCP

Phase 8:
- VS Code extension

At the end of every phase:

- run tests
- run type checking
- run lint
- run build
- inspect the diff
- fix errors before continuing

==================================================
IMPORTANT
==================================================

Do not make the product a simple wrapper around an LLM.

The important intellectual property is the orchestration layer:

    Team
      ↓
    Lead
      ↓
    Task Graph
      ↓
    Specialized Agents
      ↓
    Shared Knowledge
      ↓
    Verification
      ↓
    Human Approval

Keep this architecture clean and extensible.

Avoid unnecessary dependencies.

Prefer standard Node.js APIs where practical.

Use dependency injection.

Use interfaces around external systems.

Make all important state inspectable in the repository.

When uncertain about a design decision, document the decision and choose the simplest extensible solution.

Start by creating the project architecture and Phase 1 implementation.

Do not implement future phases until Phase 1 is stable and tested.