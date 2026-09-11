import * as vscode from 'vscode';
import { runDecisions } from '@crewforge/cli';
import type { DecisionSummary } from '@crewforge/cli';
import { ListTreeProvider } from './list-tree-provider.js';

export class DecisionsTreeProvider extends ListTreeProvider<DecisionSummary> {
  async load(cwd: string): Promise<DecisionSummary[]> {
    return runDecisions(cwd);
  }

  getTreeItem(decision: DecisionSummary): vscode.TreeItem {
    const item = new vscode.TreeItem(decision.title, vscode.TreeItemCollapsibleState.None);
    item.description = decision.id;
    item.iconPath = new vscode.ThemeIcon('note');
    return item;
  }
}
