import * as vscode from 'vscode';
import { approveRun, runRun, runStatus } from '@crewforge/cli';
import type { AgentEvent, AgentRuntime } from '@crewforge/core';
import { MockRuntime } from '@crewforge/runtime';
import { VsCodeLmRuntime } from './runtime/vscode-lm-runtime.js';
import { TeamTreeProvider } from './providers/team-provider.js';
import { TaskTreeProvider } from './providers/tasks-provider.js';
import { ChangedFilesTreeProvider } from './providers/changed-files-provider.js';
import { DecisionsTreeProvider } from './providers/decisions-provider.js';

export function activate(context: vscode.ExtensionContext): void {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const output = vscode.window.createOutputChannel('CrewForge');
  context.subscriptions.push(output);

  if (!cwd) {
    output.appendLine(
      'CrewForge: no workspace folder open \u2014 the CrewForge views are disabled.',
    );
    return;
  }

  const teamProvider = new TeamTreeProvider(cwd);
  const taskProvider = new TaskTreeProvider(cwd);
  const changedFilesProvider = new ChangedFilesTreeProvider(cwd);
  const decisionsProvider = new DecisionsTreeProvider(cwd);
  const providers = [teamProvider, taskProvider, changedFilesProvider, decisionsProvider];

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('crewforgeTeam', teamProvider),
    vscode.window.registerTreeDataProvider('crewforgeTasks', taskProvider),
    vscode.window.registerTreeDataProvider('crewforgeChangedFiles', changedFilesProvider),
    vscode.window.registerTreeDataProvider('crewforgeDecisions', decisionsProvider),
  );

  const refresh = (): void => providers.forEach((provider) => provider.refresh());

  context.subscriptions.push(
    vscode.commands.registerCommand('crewforge.refresh', refresh),
    vscode.commands.registerCommand('crewforge.run', () => runCommand(cwd, output, refresh)),
    vscode.commands.registerCommand('crewforge.approveLatestRun', () =>
      approveLatestRunCommand(cwd, refresh),
    ),
  );
}

export function deactivate(): void {
  // Nothing to tear down: no timers, watchers, or long-lived connections are held open.
}

async function runCommand(
  cwd: string,
  output: vscode.OutputChannel,
  refresh: () => void,
): Promise<void> {
  const request = await vscode.window.showInputBox({
    prompt: 'What should the CrewForge team work on?',
    placeHolder: 'Add a health check endpoint',
  });
  if (!request) return;

  const runtime = await resolveRuntime(output);
  output.show(true);
  output.appendLine(`\n$ crewforge run "${request}"`);

  const outcome = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'CrewForge is working\u2026' },
    () =>
      runRun({
        cwd,
        request,
        runtime,
        onEvent: (event: AgentEvent) => output.appendLine(renderEvent(event)),
      }),
  );

  refresh();

  const { tasksCompleted, tasksFailed, tasksNeedsReview } = outcome.sessionSummary;
  output.appendLine(
    `${tasksCompleted} completed, ${tasksFailed} failed, ${tasksNeedsReview} need review`,
  );

  if (!outcome.requiresApproval) {
    await approveRun(cwd, outcome.runId);
    refresh();
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `CrewForge run finished: ${tasksCompleted} completed, ${tasksFailed} failed, ${tasksNeedsReview} need review. Approve?`,
    'Approve',
    'Leave for review',
  );
  if (choice === 'Approve') {
    await approveRun(cwd, outcome.runId);
    refresh();
  }
}

async function approveLatestRunCommand(cwd: string, refresh: () => void): Promise<void> {
  const status = await runStatus(cwd);
  if (!status) {
    void vscode.window.showWarningMessage('CrewForge: no runs yet.');
    return;
  }
  await approveRun(cwd, status.runId);
  refresh();
  void vscode.window.showInformationMessage(`Approved run ${status.runId}.`);
}

/** Prefers the real `vscode.lm`-backed runtime; falls back to `MockRuntime` when no
 *  Copilot model is available (e.g. Copilot Chat not installed/signed in). */
async function resolveRuntime(output: vscode.OutputChannel): Promise<AgentRuntime> {
  try {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length > 0) return new VsCodeLmRuntime();
  } catch (error) {
    output.appendLine(`CrewForge: vscode.lm unavailable (${String(error)}), using MockRuntime.`);
  }
  output.appendLine('CrewForge: no Copilot model available, using MockRuntime.');
  return new MockRuntime();
}

function renderEvent(event: AgentEvent): string {
  const scope = event.agentId ? `[${event.agentId}] ` : '';
  return `${scope}${event.type}${event.data ? ` ${JSON.stringify(event.data)}` : ''}`;
}
