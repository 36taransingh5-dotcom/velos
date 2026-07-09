import type { Policy } from '@/db/schema';

/*
 * Decision order (first match wins) — unchanged from the MVP:
 *
 *   vendor not allowed ──────────────► denied
 *   amount > remaining budget ───────► denied
 *   amount < auto_approve_under ─────► approved
 *   otherwise ───────────────────────► human_approval_required
 */

export type Verdict = 'approved' | 'denied' | 'human_approval_required';

export interface EvaluationResult {
  decision: Verdict;
  explanation: string;
}

export interface SpendRequest {
  agent: string;
  vendor: string;
  amount: number;
  reason?: string;
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Pick the policy that governs this agent: an explicit agent assignment
 * wins over the org default. Deterministic — oldest assignment wins ties.
 */
export function matchPolicy(policiesForOrg: Policy[], agent: string): Policy | null {
  const assigned = policiesForOrg
    .filter((p) => p.agents.includes(agent))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (assigned.length > 0) return assigned[0];
  return policiesForOrg.find((p) => p.isDefault) ?? null;
}

export function evaluate(
  policy: Pick<Policy, 'monthlyBudget' | 'autoApproveUnder' | 'allowedVendors'>,
  request: Pick<SpendRequest, 'vendor' | 'amount'>,
  monthToDateSpend: number,
): EvaluationResult {
  const budget = Number(policy.monthlyBudget);
  const threshold = Number(policy.autoApproveUnder);
  const remaining = budget - monthToDateSpend;

  if (!policy.allowedVendors.includes(request.vendor)) {
    return {
      decision: 'denied',
      explanation: `Vendor "${request.vendor}" is not on the allowed vendor list (${policy.allowedVendors.join(', ') || 'empty'}).`,
    };
  }

  if (request.amount > remaining) {
    return {
      decision: 'denied',
      explanation: `Amount ${usd(request.amount)} exceeds remaining monthly budget of ${usd(remaining)} (budget ${usd(budget)}, spent ${usd(monthToDateSpend)}).`,
    };
  }

  if (request.amount < threshold) {
    return {
      decision: 'approved',
      explanation: `Auto-approved: ${usd(request.amount)} is under the ${usd(threshold)} auto-approval threshold and within budget.`,
    };
  }

  return {
    decision: 'human_approval_required',
    explanation: `Amount ${usd(request.amount)} is at or above the ${usd(threshold)} auto-approval threshold. Within budget, but requires human sign-off.`,
  };
}

export type ValidationResult =
  | { ok: true; value: SpendRequest }
  | { ok: false; errors: string[] };

/** Normalize and validate an /evaluate request body. 400-guard everything. */
export function validateRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const { agent, vendor, amount, reason } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof agent !== 'string' || agent.trim() === '') {
    errors.push('"agent" is required and must be a non-empty string.');
  }
  if (typeof vendor !== 'string' || vendor.trim() === '') {
    errors.push('"vendor" is required and must be a non-empty string.');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    errors.push('"amount" is required and must be a positive number.');
  }
  if (reason !== undefined && typeof reason !== 'string') {
    errors.push('"reason" must be a string when provided.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      agent: (agent as string).trim(),
      vendor: (vendor as string).trim(),
      amount: amount as number,
      reason: reason as string | undefined,
    },
  };
}
