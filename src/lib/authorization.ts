import { evaluate, matchPolicy } from '@/lib/engine';
import {
  findMatchingIntent,
  listPolicies,
  monthToDateSpend,
  recordDecision,
  settleIntent,
} from '@/lib/store';
import type { AgentCard, Policy } from '@/db/schema';

export interface ChargeInput {
  amount: number;
  // Raw merchant descriptor from the card network (e.g. "OPENAI *CHATGPT").
  merchant: string;
  // Network / simulator authorization id.
  authorizationId: string;
}

export interface AuthorizationResult {
  // What Velos tells the card network.
  authorization: 'approved' | 'declined';
  // The underlying policy verdict (human_approval_required declines the live
  // charge but leaves a pending item a human can approve, then the agent retries).
  decision: 'approved' | 'denied' | 'human_approval_required';
  explanation: string;
  decisionId: string | null;
  matchedIntent: boolean;
}

/**
 * A card auth carries only a merchant descriptor, not the clean vendor the
 * agent named. Map it back: if an allowed vendor name appears in the
 * descriptor, use it; otherwise pass the raw descriptor through (it will
 * fail the allowlist and be denied, which is the safe default).
 */
function merchantToVendor(merchant: string, policy: Policy): string {
  const m = merchant.toLowerCase();
  for (const v of policy.allowedVendors) {
    if (m.includes(v.toLowerCase())) return v;
  }
  return merchant;
}

/**
 * The enforcement gate. A live charge on a Velos card lands here; we decide
 * approve/decline within the network's ~2s window.
 *
 *   frozen card ─────────────► decline
 *   matches a recent intent ─► approve, settle the intent (no double budget)
 *   no intent ──────────────► run the policy engine on the charge:
 *        approved → approve (+ record, counts budget)
 *        denied   → decline (+ record)
 *        human    → decline the live charge, queue for approval + retry
 */
export async function authorizeCharge(
  card: AgentCard,
  input: ChargeInput,
): Promise<AuthorizationResult> {
  const { orgId, agent } = card;

  if (card.status === 'frozen') {
    const rec = await recordDecision({
      orgId,
      policyId: null,
      policyName: '—',
      agent,
      vendor: input.merchant,
      amount: input.amount.toFixed(2),
      reason: null,
      decision: 'denied',
      explanation: `Card ending ${card.last4} is frozen. Charge declined.`,
      source: 'card',
      cardId: card.id,
      authorizationId: input.authorizationId,
    });
    return {
      authorization: 'declined',
      decision: 'denied',
      explanation: rec.explanation,
      decisionId: rec.id,
      matchedIntent: false,
    };
  }

  const policies = await listPolicies(orgId);
  const policy = matchPolicy(policies, agent);
  if (!policy) {
    const rec = await recordDecision({
      orgId,
      policyId: null,
      policyName: '—',
      agent,
      vendor: input.merchant,
      amount: input.amount.toFixed(2),
      reason: null,
      decision: 'denied',
      explanation:
        'No policy matches this agent and no default policy exists. Charge declined.',
      source: 'card',
      cardId: card.id,
      authorizationId: input.authorizationId,
    });
    return {
      authorization: 'declined',
      decision: 'denied',
      explanation: rec.explanation,
      decisionId: rec.id,
      matchedIntent: false,
    };
  }

  // The agent asked first and we approved — honor that intent, don't
  // re-evaluate or double-count the budget.
  const intent = await findMatchingIntent(orgId, agent, input.amount);
  if (intent) {
    await settleIntent(intent.id, input.authorizationId);
    return {
      authorization: 'approved',
      decision: 'approved',
      explanation: `Approved — matched a pre-authorized request (${intent.vendor}). ${intent.explanation}`,
      decisionId: intent.id,
      matchedIntent: true,
    };
  }

  // Standalone charge (agent didn't ask first). Evaluate it live.
  const vendor = merchantToVendor(input.merchant, policy);
  const spent = await monthToDateSpend(policy.id);
  const { decision, explanation } = evaluate(policy, { vendor, amount: input.amount }, spent);

  const rec = await recordDecision({
    orgId,
    policyId: policy.id,
    policyName: policy.name,
    agent,
    vendor,
    amount: input.amount.toFixed(2),
    reason: `card charge at "${input.merchant}"`,
    decision,
    explanation,
    source: 'card',
    cardId: card.id,
    authorizationId: input.authorizationId,
  });

  // Only an outright approval lets the live charge through. A human hold
  // declines now; the human approves in the dashboard and the agent retries,
  // which then matches this row as an intent.
  const authorization = decision === 'approved' ? 'approved' : 'declined';

  return {
    authorization,
    decision,
    explanation,
    decisionId: rec.id,
    matchedIntent: false,
  };
}
