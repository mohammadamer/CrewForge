import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERMISSION_POLICY,
  mergePermissionPolicy,
  PermissionEvaluator,
} from '@crewforge/core';

describe('PermissionEvaluator', () => {
  it('always requires approval for destructive action kinds regardless of policy', () => {
    const evaluator = new PermissionEvaluator({
      shell: 'full',
      network: 'full',
      filesystem: 'repository',
      deployment: 'allowed',
    });

    expect(evaluator.check({ kind: 'file-delete', description: 'delete file' })).toBe(
      'requires-approval',
    );
    expect(evaluator.check({ kind: 'deployment', description: 'deploy to prod' })).toBe(
      'requires-approval',
    );
  });

  it('denies shell commands when policy is none', () => {
    const evaluator = new PermissionEvaluator({ ...DEFAULT_PERMISSION_POLICY, shell: 'none' });
    expect(evaluator.check({ kind: 'shell-command', description: 'rm -rf /' })).toBe('denied');
  });

  it('allows shell commands when policy is full', () => {
    const evaluator = new PermissionEvaluator({ ...DEFAULT_PERMISSION_POLICY, shell: 'full' });
    expect(evaluator.check({ kind: 'shell-command', description: 'ls' })).toBe('allowed');
  });

  it('requires approval for restricted shell/network access', () => {
    const evaluator = new PermissionEvaluator(DEFAULT_PERMISSION_POLICY);
    expect(evaluator.check({ kind: 'shell-command', description: 'npm test' })).toBe(
      'requires-approval',
    );
    expect(evaluator.check({ kind: 'network-request', description: 'fetch api' })).toBe(
      'requires-approval',
    );
  });

  it('denies file writes when filesystem policy is readonly', () => {
    const evaluator = new PermissionEvaluator({
      ...DEFAULT_PERMISSION_POLICY,
      filesystem: 'readonly',
    });
    expect(evaluator.check({ kind: 'file-write', description: 'write file' })).toBe('denied');
  });
});

describe('mergePermissionPolicy', () => {
  it('layers overrides on top of a base policy in order', () => {
    const merged = mergePermissionPolicy(
      DEFAULT_PERMISSION_POLICY,
      { shell: 'full' },
      { network: 'none' },
    );
    expect(merged).toEqual({
      shell: 'full',
      network: 'none',
      filesystem: 'repository',
      deployment: 'approval-required',
    });
  });

  it('ignores undefined overrides', () => {
    const merged = mergePermissionPolicy(DEFAULT_PERMISSION_POLICY, undefined);
    expect(merged).toEqual(DEFAULT_PERMISSION_POLICY);
  });
});
