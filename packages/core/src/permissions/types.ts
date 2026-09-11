export type ShellPermission = 'none' | 'restricted' | 'full';
export type NetworkPermission = 'none' | 'restricted' | 'full';
export type FilesystemPermission = 'repository' | 'readonly';
export type DeploymentPermission = 'blocked' | 'approval-required' | 'allowed';

export interface PermissionPolicy {
  shell: ShellPermission;
  network: NetworkPermission;
  filesystem: FilesystemPermission;
  deployment: DeploymentPermission;
}

/** Per-agent overrides layered on top of the team-wide `PermissionPolicy`. */
export type PermissionPolicyOverride = Partial<PermissionPolicy>;

/** Never grant unrestricted access by default. */
export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = {
  shell: 'restricted',
  network: 'restricted',
  filesystem: 'repository',
  deployment: 'approval-required',
};

export type PermissionDecision = 'allowed' | 'denied' | 'requires-approval';

export type PermissionActionKind =
  | 'shell-command'
  | 'network-request'
  | 'file-write'
  | 'file-delete'
  | 'deployment'
  | 'git-push-protected-branch'
  | 'git-merge'
  | 'db-migration'
  | 'security-config-change'
  | 'credential-write'
  | 'conflict-resolution';

export interface PermissionAction {
  kind: PermissionActionKind;
  description: string;
  /** e.g. the shell command, file path, or branch name involved. */
  target?: string;
}

export function mergePermissionPolicy(
  base: PermissionPolicy,
  ...overrides: Array<PermissionPolicyOverride | undefined>
): PermissionPolicy {
  return overrides.reduce<PermissionPolicy>(
    (policy, override) => (override ? { ...policy, ...override } : policy),
    base,
  );
}
