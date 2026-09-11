import type { PermissionAction, PermissionDecision, PermissionPolicy } from './types.js';

/** Action kinds that always require human approval, regardless of policy. */
const ALWAYS_REQUIRES_APPROVAL: ReadonlySet<PermissionAction['kind']> = new Set([
  'file-delete',
  'deployment',
  'git-push-protected-branch',
  'git-merge',
  'db-migration',
  'security-config-change',
  'credential-write',
]);

/** Evaluates a single agent action against a `PermissionPolicy`. Never grants unlimited access. */
export class PermissionEvaluator {
  constructor(private readonly policy: PermissionPolicy) {}

  check(action: PermissionAction): PermissionDecision {
    if (ALWAYS_REQUIRES_APPROVAL.has(action.kind)) {
      return 'requires-approval';
    }
    switch (action.kind) {
      case 'shell-command':
        return this.fromLevel(this.policy.shell);
      case 'network-request':
        return this.fromLevel(this.policy.network);
      case 'file-write':
        return this.policy.filesystem === 'readonly' ? 'denied' : 'allowed';
      default:
        return 'requires-approval';
    }
  }

  private fromLevel(level: 'none' | 'restricted' | 'full'): PermissionDecision {
    if (level === 'none') return 'denied';
    if (level === 'full') return 'allowed';
    return 'requires-approval';
  }
}
