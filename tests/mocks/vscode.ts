/**
 * Minimal hand-rolled stand-in for the `vscode` module, which only exists inside a real
 * Extension Host — used solely so unit tests can exercise CrewForge's own extension logic
 * (tree providers, the vscode.lm-backed runtime) without launching VS Code itself.
 * Implements only the small surface this extension actually uses.
 */
import { vi } from 'vitest';

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  description?: string;
  iconPath?: unknown;
  resourceUri?: unknown;
  constructor(
    public label: string,
    public collapsibleState?: TreeItemCollapsibleState,
  ) {}
}

export class ThemeIcon {
  constructor(public id: string) {}
}

export class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];
  event = (listener: (value: T) => void): { dispose(): void } => {
    this.listeners.push(listener);
    return { dispose: () => undefined };
  };
  fire(value: T): void {
    for (const listener of this.listeners) listener(value);
  }
}

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file' }),
};

export class LanguageModelChatMessage {
  static User(content: string): { role: 'user'; content: string } {
    return { role: 'user', content };
  }
}

export class CancellationTokenSource {
  token = {};
}

export const lm = {
  selectChatModels: vi.fn(),
};

export const window = {
  createOutputChannel: vi.fn(),
  registerTreeDataProvider: vi.fn(),
  showInputBox: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  withProgress: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const workspace = {
  workspaceFolders: undefined,
};

export enum ProgressLocation {
  Notification = 15,
}
