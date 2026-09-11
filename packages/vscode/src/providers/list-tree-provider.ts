import * as vscode from 'vscode';

/** Shared plumbing for CrewForge's flat, list-style tree views: an item is just a
 *  label + description + icon; `refresh()` re-runs `load()` and updates the view. */
export abstract class ListTreeProvider<T> implements vscode.TreeDataProvider<T> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly cwd: string) {}

  refresh(): void {
    this.emitter.fire();
  }

  protected get workspaceRoot(): string {
    return this.cwd;
  }

  getChildren(element?: T): Thenable<T[]> {
    if (element) return Promise.resolve([]);
    return this.load(this.cwd);
  }

  abstract load(cwd: string): Promise<T[]>;
  abstract getTreeItem(element: T): vscode.TreeItem;
}
