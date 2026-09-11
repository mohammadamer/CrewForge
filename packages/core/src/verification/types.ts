export interface VerificationCommandConfig {
  test?: string;
  lint?: string;
  build?: string;
}

export type VerificationCommandName = keyof VerificationCommandConfig;

export interface VerificationCommandResult {
  name: VerificationCommandName;
  command: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface VerificationSummary {
  passed: boolean;
  results: VerificationCommandResult[];
}

/** Runs the repository's configured verification commands (test/lint/build). See `CommandVerificationRunner`. */
export interface VerificationRunner {
  run(config: VerificationCommandConfig): Promise<VerificationSummary>;
}
