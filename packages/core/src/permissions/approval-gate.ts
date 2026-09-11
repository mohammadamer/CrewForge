import { createAgentEvent } from '../events/factory.js';
import type { EventBus } from '../events/event-bus.js';
import { PermissionEvaluator } from './permission-evaluator.js';
import type { PermissionAction, PermissionPolicy } from './types.js';

export type ApprovalDecision = 'approve' | 'reject' | 'modify' | 'retry';

export interface ApprovalRequest {
  action: PermissionAction;
  /** Free-form context shown to the human (e.g. a suggested conflict resolution). */
  detail?: string;
}

export interface ApprovalOutcome {
  decision: ApprovalDecision;
  /** Why the gate resolved this way without asking (e.g. denied by policy). */
  autoResolved?: boolean;
}

export type ApprovalDecider = (request: ApprovalRequest) => Promise<ApprovalDecision>;

export interface ApprovalGateOptions {
  policy: PermissionPolicy;
  /** Consulted only when the policy says the action `requires-approval`. */
  decide: ApprovalDecider;
  eventBus?: EventBus;
}

/**
 * The single choke point dangerous actions must pass through: policy-allowed actions
 * proceed silently, policy-denied actions are auto-rejected, and everything else pauses
 * for a human `approve`/`reject`/`modify`/`retry` decision (never a silent default).
 */
export class ApprovalGate {
  private readonly evaluator: PermissionEvaluator;
  private readonly decide: ApprovalDecider;
  private readonly eventBus?: EventBus;

  constructor(options: ApprovalGateOptions) {
    this.evaluator = new PermissionEvaluator(options.policy);
    this.decide = options.decide;
    this.eventBus = options.eventBus;
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalOutcome> {
    const policyDecision = this.evaluator.check(request.action);

    if (policyDecision === 'allowed') {
      return { decision: 'approve', autoResolved: true };
    }
    if (policyDecision === 'denied') {
      return { decision: 'reject', autoResolved: true };
    }

    this.eventBus?.publish(
      createAgentEvent('approval-requested', {
        kind: request.action.kind,
        description: request.action.description,
        target: request.action.target,
        detail: request.detail,
      }),
    );

    const decision = await this.decide(request);

    this.eventBus?.publish(
      createAgentEvent('approval-resolved', { kind: request.action.kind, decision }),
    );

    return { decision };
  }
}
