import { join } from 'node:path';
import * as vscode from 'vscode';
import { runHistory } from '@crewforge/cli';
import { ListTreeProvider } from './list-tree-provider.js';

export class ChangedFilesTreeProvider extends ListTreeProvider<string> {
  async load(cwd: string): Promise<string[]> {
    const sessions = await runHistory(cwd);
    if (sessions.length === 0) return [];

    const latest = [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    return latest?.filesChanged ?? [];
  }

  getTreeItem(file: string): vscode.TreeItem {
    const item = new vscode.TreeItem(file, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('file');
    item.resourceUri = vscode.Uri.file(join(this.workspaceRoot, file));
    return item;
  }
}
