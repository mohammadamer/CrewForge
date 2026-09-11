import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  VerificationCommandConfig,
  VerificationCommandName,
  VerificationCommandResult,
  VerificationRunner,
  VerificationSummary,
} from './types.js';

const execAsync = promisify(exec);

const COMMAND_NAMES: readonly VerificationCommandName[] = ['test', 'lint', 'build'];

export interface CommandVerificationRunnerOptions {
  cwd: string;
}

/**
 * Runs the repository's configured `test`/`lint`/`build` commands as real shell
 * commands (repo-controlled strings from `team.yaml`, the same trust level as any
 * `package.json` script) and reports pass/fail per command.
 */
export class CommandVerificationRunner implements VerificationRunner {
  constructor(private readonly options: CommandVerificationRunnerOptions) {}

  async run(config: VerificationCommandConfig): Promise<VerificationSummary> {
    const results: VerificationCommandResult[] = [];
    for (const name of COMMAND_NAMES) {
      const command = config[name];
      if (!command) continue;
      results.push(await this.runOne(name, command));
    }
    return { passed: results.every((result) => result.passed), results };
  }

  private async runOne(
    name: VerificationCommandName,
    command: string,
  ): Promise<VerificationCommandResult> {
    const startedAt = Date.now();
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.options.cwd });
      return {
        name,
        command,
        passed: true,
        exitCode: 0,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      return {
        name,
        command,
        passed: false,
        exitCode: failure.code ?? 1,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? (error instanceof Error ? error.message : String(error)),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
