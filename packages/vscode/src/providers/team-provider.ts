import * as vscode from 'vscode';
import { runAgents, runTeam } from '@crewforge/cli';
import type { AgentDefinition } from '@crewforge/core';
import { ListTreeProvider } from './list-tree-provider.js';

interface TeamRow {
  label: string;
  description: string;
  isHeader: boolean;
}

export class TeamTreeProvider extends ListTreeProvider<TeamRow> {
  async load(cwd: string): Promise<TeamRow[]> {
    const team = await runTeam(cwd);
    const agents = await runAgents(cwd);

    return [
      { label: team.name, description: `lead: ${team.lead}`, isHeader: true },
      ...agents.map((agent: AgentDefinition) => ({
        label: agent.role,
        description: `${agent.responsibilities.length} responsibilities`,
        isHeader: false,
      })),
    ];
  }

  getTreeItem(element: TeamRow): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.iconPath = new vscode.ThemeIcon(element.isHeader ? 'organization' : 'person');
    return item;
  }
}
