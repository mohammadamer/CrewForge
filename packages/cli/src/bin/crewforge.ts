#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import type { AgentEvent } from '@crewforge/core';
import { runInit } from '../commands/init.js';
import { runTeam } from '../commands/team.js';
import { runAgents } from '../commands/agents.js';
import { runAgentCreate } from '../commands/agent-create.js';
import { runStatus } from '../commands/status.js';
import { runDecisions, runDecisionShow } from '../commands/decisions.js';
import { runHistory, runHistoryDetail } from '../commands/history.js';
import { runDoctor } from '../commands/doctor.js';
import { runTaskCreate } from '../commands/task.js';
import { runAsk } from '../commands/ask.js';
import { approveRun, runRun } from '../commands/run.js';
import { renderEvent } from '../ui/render-event.js';
import { confirm } from '../ui/prompt.js';
import { resolveRuntime } from '../runtime-selection.js';
import type { RuntimeChoice } from '../runtime-selection.js';

const program = new Command();

program.name('crewforge').description('A repo-native AI engineering team.').version('0.1.0');

program
  .command('init')
  .description('Scaffold .crewforge/ in the current repository')
  .option('--name <name>', 'team name (defaults to the directory name)')
  .option('--force', 'overwrite an existing .crewforge/team.yaml')
  .action(async (opts: { name?: string; force?: boolean }) => {
    const result = await runInit({ cwd: process.cwd(), name: opts.name, force: opts.force });
    console.log(chalk.green(`Initialized CrewForge in ${result.crewforgeDir}`));
    for (const file of result.createdFiles) console.log(`  ${chalk.dim('created')} ${file}`);
  });

program
  .command('team')
  .description('Show the current team configuration')
  .action(async () => {
    const team = await runTeam(process.cwd());
    console.log(JSON.stringify(team, null, 2));
  });

const agents = program.command('agents').description('Manage agent definitions');

agents
  .command('list', { isDefault: true })
  .description('List configured agents')
  .action(async () => {
    const list = await runAgents(process.cwd());
    for (const agent of list) {
      console.log(
        `${chalk.bold(agent.role)} ${chalk.dim(`(${agent.responsibilities.length} responsibilities)`)}`,
      );
    }
  });

agents
  .command('create <role>')
  .description('Scaffold a new agent definition from a built-in template (or a blank one)')
  .option('--force', 'overwrite an existing agent definition')
  .action(async (role: string, opts: { force?: boolean }) => {
    const path = await runAgentCreate({ cwd: process.cwd(), role, force: opts.force });
    console.log(chalk.green(`Created ${path}`));
  });

program
  .command('status')
  .description("Show the most recent run's task graph")
  .action(async () => {
    const status = await runStatus(process.cwd());
    if (!status) {
      console.log(chalk.dim('No runs yet. Try: crewforge run "<request>"'));
      return;
    }
    console.log(chalk.bold(status.request));
    console.log(chalk.dim(`run ${status.runId} \u2014 ${status.createdAt}`));
    for (const task of status.tasks) {
      console.log(
        `  ${statusIcon(task.status)} ${task.title} ${chalk.dim(`(${task.owner ?? 'unassigned'})`)}`,
      );
    }
  });

const decisions = program.command('decisions').description('Inspect Architecture Decision Records');

decisions
  .command('list', { isDefault: true })
  .description('List recorded decisions')
  .action(async () => {
    const list = await runDecisions(process.cwd());
    if (list.length === 0) {
      console.log(chalk.dim('No decisions recorded yet.'));
      return;
    }
    for (const decision of list) console.log(`${chalk.bold(decision.id)}  ${decision.title}`);
  });

decisions
  .command('show <id>')
  .description('Print one decision record')
  .action(async (id: string) => {
    console.log(await runDecisionShow(process.cwd(), id));
  });

const history = program.command('history').description('Inspect past runs');

history
  .command('list', { isDefault: true })
  .description('List archived runs')
  .action(async () => {
    const sessions = await runHistory(process.cwd());
    if (sessions.length === 0) {
      console.log(chalk.dim('No archived runs yet.'));
      return;
    }
    for (const session of sessions) {
      console.log(
        `${chalk.bold(session.runId)}  ${session.request}  ${chalk.dim(`${session.durationMs}ms`)}`,
      );
    }
  });

history
  .command('show <runId>')
  .description('Print one run in full detail')
  .action(async (runId: string) => {
    console.log(JSON.stringify(await runHistoryDetail(process.cwd(), runId), null, 2));
  });

program
  .command('doctor')
  .description('Check the local environment and .crewforge/ configuration')
  .action(async () => {
    const report = await runDoctor(process.cwd());
    for (const check of report.checks) {
      const icon = check.passed ? chalk.green('\u2713') : chalk.red('\u2717');
      console.log(`${icon} ${check.name} ${chalk.dim(check.detail)}`);
    }
    if (!report.healthy) process.exitCode = 1;
  });

const task = program.command('task').description('Manage tasks directly');

task
  .command('create <title>')
  .description('Manually add a task for the Lead to triage')
  .option('--description <description>', 'a longer description of the task')
  .action(async (title: string, opts: { description?: string }) => {
    const result = await runTaskCreate({
      cwd: process.cwd(),
      title,
      description: opts.description,
    });
    console.log(chalk.green(`Created task ${result.taskId} (run ${result.runId})`));
  });

program
  .command('ask <role> <question>')
  .description('Ask a single agent a question, bypassing the task graph')
  .option('--runtime <runtime>', 'mock or copilot')
  .action(async (role: string, question: string, opts: { runtime?: RuntimeChoice }) => {
    const runtime = resolveRuntime({ choice: opts.runtime });
    const result = await runAsk({
      cwd: process.cwd(),
      role,
      question,
      runtime,
      onEvent: (event: AgentEvent) => console.log(renderEvent(event)),
    });
    console.log(result.success ? chalk.green(result.summary) : chalk.red(result.summary));
  });

program
  .command('run <request>')
  .description('Delegate a request to the team: plan, implement, verify, and request approval')
  .option('--runtime <runtime>', 'mock or copilot')
  .option('--yes', 'skip the final approval prompt and auto-approve')
  .action(async (request: string, opts: { runtime?: RuntimeChoice; yes?: boolean }) => {
    const runtime = resolveRuntime({ choice: opts.runtime });
    const outcome = await runRun({
      cwd: process.cwd(),
      request,
      runtime,
      onEvent: (event: AgentEvent) => console.log(renderEvent(event)),
    });

    console.log('');
    console.log(chalk.bold('Files changed:'));
    for (const file of outcome.sessionSummary.filesChanged) console.log(`  ${file}`);
    if (outcome.sessionSummary.filesChanged.length === 0) console.log(chalk.dim('  (none)'));

    if (outcome.summary.verification) {
      console.log('');
      console.log(chalk.bold('Verification:'));
      for (const result of outcome.summary.verification.results) {
        const icon = result.passed ? chalk.green('\u2713') : chalk.red('\u2717');
        console.log(`  ${icon} ${result.name} (${result.command})`);
      }
    }

    if (outcome.summary.conflicts.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('Conflicts detected \u2014 human review required:'));
      for (const conflict of outcome.summary.conflicts) {
        console.log(
          `  ${chalk.yellow('\u26A0')} ${conflict.file} (tasks: ${conflict.taskIds.join(', ')})`,
        );
        if (conflict.suggestedResolution) {
          console.log(`    ${chalk.dim(conflict.suggestedResolution)}`);
        }
      }
    }

    if (outcome.summary.worktreeConflicts.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('Worktree merge conflicts — human review required:'));
      for (const conflict of outcome.summary.worktreeConflicts) {
        console.log(`  ${chalk.yellow('⚠')} task ${conflict.taskId} (branch: ${conflict.branch})`);
      }
    }

    console.log('');
    console.log(
      `${chalk.bold(outcome.sessionSummary.tasksCompleted)} completed, ` +
        `${chalk.bold(outcome.sessionSummary.tasksFailed)} failed, ` +
        `${chalk.bold(outcome.sessionSummary.tasksNeedsReview)} need review`,
    );

    if (!outcome.requiresApproval) {
      await approveRun(process.cwd(), outcome.runId);
      console.log(chalk.dim('human_approval is disabled for this team \u2014 auto-approved.'));
      return;
    }

    const approved = opts.yes || (await confirm('Approve changes?'));
    if (approved) {
      await approveRun(process.cwd(), outcome.runId);
      console.log(chalk.green('Approved.'));
    } else {
      console.log(chalk.yellow('Left for review. Nothing was approved.'));
    }
  });

function statusIcon(status: string): string {
  if (status === 'completed' || status === 'approved') return chalk.green('\u2713');
  if (status === 'failed') return chalk.red('\u2717');
  if (status === 'needs-review') return chalk.yellow('\u26A0');
  if (status === 'running') return chalk.cyan('\u25CF');
  return chalk.dim('\u25CB');
}

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
