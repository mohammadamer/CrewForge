import { describe, expect, it, vi } from 'vitest';
import {
  ApprovalGate,
  DEFAULT_PERMISSION_POLICY,
  EventBus,
  type ApprovalDecision,
} from '@crewforge/core';

describe('ApprovalGate', () => {
  it('auto-approves actions the policy allows without consulting the decider', async () => {
    const decide = vi.fn<() => Promise<ApprovalDecision>>();
    const gate = new ApprovalGate({
      policy: { ...DEFAULT_PERMISSION_POLICY, shell: 'full' },
      decide,
    });

    const outcome = await gate.requestApproval({
      action: { kind: 'shell-command', description: 'ls' },
    });

    expect(outcome).toEqual({ decision: 'approve', autoResolved: true });
    expect(decide).not.toHaveBeenCalled();
  });

  it('auto-rejects actions the policy denies without consulting the decider', async () => {
    const decide = vi.fn<() => Promise<ApprovalDecision>>();
    const gate = new ApprovalGate({
      policy: { ...DEFAULT_PERMISSION_POLICY, shell: 'none' },
      decide,
    });

    const outcome = await gate.requestApproval({
      action: { kind: 'shell-command', description: 'rm -rf /' },
    });

    expect(outcome).toEqual({ decision: 'reject', autoResolved: true });
    expect(decide).not.toHaveBeenCalled();
  });

  it('always asks a human for action kinds that always require approval', async () => {
    const decide = vi.fn(async () => 'approve' as const);
    const gate = new ApprovalGate({ policy: DEFAULT_PERMISSION_POLICY, decide });

    const outcome = await gate.requestApproval({
      action: { kind: 'file-delete', description: 'delete secrets.env' },
    });

    expect(outcome).toEqual({ decision: 'approve' });
    expect(decide).toHaveBeenCalledOnce();
  });

  it('supports reject/modify/retry decisions from the decider', async () => {
    const decide = vi.fn(async () => 'modify' as const);
    const gate = new ApprovalGate({ policy: DEFAULT_PERMISSION_POLICY, decide });

    const outcome = await gate.requestApproval({
      action: { kind: 'conflict-resolution', description: 'merge overlapping edits' },
    });

    expect(outcome.decision).toBe('modify');
  });

  it('emits approval-requested and approval-resolved events around the decision', async () => {
    const eventBus = new EventBus();
    const events: string[] = [];
    eventBus.onEvent((event) => events.push(event.type));

    const gate = new ApprovalGate({
      policy: DEFAULT_PERMISSION_POLICY,
      decide: async () => 'reject',
      eventBus,
    });

    await gate.requestApproval({ action: { kind: 'deployment', description: 'deploy to prod' } });

    expect(events).toEqual(['approval-requested', 'approval-resolved']);
  });

  it('does not emit events for auto-resolved (allowed/denied) actions', async () => {
    const eventBus = new EventBus();
    const events: string[] = [];
    eventBus.onEvent((event) => events.push(event.type));

    const gate = new ApprovalGate({
      policy: { ...DEFAULT_PERMISSION_POLICY, shell: 'full' },
      decide: async () => 'approve',
      eventBus,
    });

    await gate.requestApproval({ action: { kind: 'shell-command', description: 'ls' } });

    expect(events).toEqual([]);
  });
});
