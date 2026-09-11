import type { Workflow } from './types.js';

/**
 * CrewForge's single built-in workflow. A generic, declarative `workflows:` engine
 * (per build.md's CUSTOM WORKFLOWS section) is intentionally out of scope for the
 * MVP; this fixed sequence is what the Lead follows for every run today.
 */
export const FEATURE_WORKFLOW: Workflow = {
  name: 'feature',
  steps: [
    {
      id: 'lead.plan',
      agentRole: 'lead',
      description: 'Understand the request, inspect the repository, produce a task graph',
    },
    {
      id: 'backend.implement',
      agentRole: 'backend',
      description: 'Implement backend changes',
      parallelGroup: 'implementation',
    },
    {
      id: 'frontend.implement',
      agentRole: 'frontend',
      description: 'Implement frontend changes',
      parallelGroup: 'implementation',
    },
    {
      id: 'lead.integrate',
      agentRole: 'lead',
      description: 'Reconcile results and detect overlapping/conflicting changes',
    },
    {
      id: 'qa.verify',
      agentRole: 'qa',
      description: 'Run tests, lint, and build',
    },
    {
      id: 'security.review',
      agentRole: 'security',
      description: 'Review security-sensitive changes, when relevant',
    },
    {
      id: 'lead.final-review',
      agentRole: 'lead',
      description: 'Summarize changes and route to human approval',
    },
  ],
};
