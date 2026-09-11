export interface WorkflowStep {
  /** Dot-notation `agentRole.action`, matching build.md's workflow examples (e.g. `backend.implement`). */
  id: string;
  agentRole: string;
  description: string;
  /** Steps sharing a group id may execute concurrently. */
  parallelGroup?: string;
}

/**
 * An ordered sequence of steps the Lead follows for a run.
 * MVP ships a single built-in workflow (see the orchestration phase); a generic
 * declarative `workflows:` engine is intentionally out of scope until post-MVP.
 */
export interface Workflow {
  name: string;
  steps: WorkflowStep[];
}
