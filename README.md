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
