import * as vscode from 'vscode';
import { runStatus } from '@crewforge/cli';
import type { StatusTask } from '@crewforge/cli';
import { ListTreeProvider } from './list-tree-provider.js';

const STATUS_ICONS: Record<string, string> = {
  completed: 'check',
  approved: 'check-all',
  failed: 'error',
  'needs-review': 'warning',
  running: 'sync~spin',
  blocked: 'circle-slash',
};

export class TaskTreeProvider extends ListTreeProvider<StatusTask> {
  async load(cwd: string): Promise<StatusTask[]> {
    const status = await runStatus(cwd);
    return status?.tasks ?? [];
  }

  getTreeItem(task: StatusTask): vscode.TreeItem {
    const item = new vscode.TreeItem(task.title, vscode.TreeItemCollapsibleState.None);
    item.description = `${task.owner ?? 'unassigned'} \u2022 ${task.status}`;
    item.iconPath = new vscode.ThemeIcon(STATUS_ICONS[task.status] ?? 'circle-outline');
    return item;
  }
}
