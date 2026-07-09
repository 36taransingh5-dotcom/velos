import { evaluate, matchPolicy, type SpendRequest } from '@/lib/engine';
import {
  FREE_TIER_DECISIONS_PER_MONTH,
  getOrgPlan,
  listPolicies,
  monthlyDecisionCount,
  monthToDateSpend,
  recordDecision,
} from '@/lib/store';

export type EvaluateOutcome =
  | {
      ok: true;
      result: {
        id: string;
        decision: string;
        policy: string;
        explanation: string;
        created_at: Date;
      };
    }
  | { ok: false; status: 402 | 422; errors: string[] };

/**
 * The whole /evaluate flow after auth+validation, shared by the REST API
 * and the MCP server:
 *
 *   plan gate ──► policy match ──► budget math ──► verdict ──► audit row
 */
export async function evaluateForOrg(orgId: string, request: SpendRequest): Promise<EvaluateOutcome> {
  const plan = await getOrgPlan(orgId);
  if (plan === 'free') {
    const used = await monthlyDecisionCount(orgId);
    if (used >= FREE_TIER_DECISIONS_PER_MONTH) {
      return {
        ok: false,
        status: 402,
        errors: [
          `Free tier limit reached (${FREE_TIER_DECISIONS_PER_MONTH} decisions/month). Upgrade to Pro for unlimited decisions.`,
        ],
      };
    }
  }

  const orgPolicies = await listPolicies(orgId);
  const policy = matchPolicy(orgPolicies, request.agent);
  if (!policy) {
    return {
      ok: false,
      status: 422,
      errors: [
        'No policy matches this agent and no default policy exists. Create a policy in the Velos dashboard.',
      ],
    };
  }

  const spent = await monthToDateSpend(policy.id);
  const { decision, explanation } = evaluate(policy, request, spent);

  const record = await recordDecision({
    orgId,
    policyId: policy.id,
    policyName: policy.name,
    agent: request.agent,
    vendor: request.vendor,
    amount: request.amount.toFixed(2),
    reason: request.reason ?? null,
    decision,
    explanation,
  });

  return {
    ok: true,
    result: {
      id: record.id,
      decision,
      policy: policy.name,
      explanation,
      created_at: record.createdAt,
    },
  };
}
