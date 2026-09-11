/** Base class for all CrewForge domain errors. */
export class CrewForgeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Thrown when input data (config, agent definitions, task graphs, ...) fails schema validation. */
export class ValidationError extends CrewForgeError {}

/** Thrown when a referenced entity (task, agent, decision, session, ...) cannot be found. */
export class NotFoundError extends CrewForgeError {}

/** Thrown by capabilities that are intentionally deferred to a later build phase. */
export class NotImplementedError extends CrewForgeError {}
