/*
 * Decision order (first match wins):
 *
 *   vendor not allowed ──────────────► denied
 *   amount > remaining budget ───────► denied
 *   amount < auto_approve_under ─────► approved
 *   otherwise ───────────────────────► human_approval_required
 */
export function evaluate(policy, { vendor, amount }, monthToDateSpend) {
  const remaining = policy.monthly_budget - monthToDateSpend;

  if (!policy.allowed_vendors.includes(vendor)) {
    return {
      decision: 'denied',
      explanation: `Vendor "${vendor}" is not on the allowed vendor list (${policy.allowed_vendors.join(', ')}).`,
    };
  }

  if (amount > remaining) {
    return {
      decision: 'denied',
      explanation: `Amount $${amount.toFixed(2)} exceeds remaining monthly budget of $${remaining.toFixed(2)} (budget $${policy.monthly_budget.toFixed(2)}, spent $${monthToDateSpend.toFixed(2)}).`,
    };
  }

  if (amount < policy.auto_approve_under) {
    return {
      decision: 'approved',
      explanation: `Auto-approved: $${amount.toFixed(2)} is under the $${policy.auto_approve_under.toFixed(2)} auto-approval threshold and within budget.`,
    };
  }

  return {
    decision: 'human_approval_required',
    explanation: `Amount $${amount.toFixed(2)} is at or above the $${policy.auto_approve_under.toFixed(2)} auto-approval threshold. Within budget, but requires human sign-off.`,
  };
}

// Returns { ok: true, value } with a normalized request, or { ok: false, errors }.
export function validateRequest(body) {
  const errors = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const { agent, vendor, amount, reason } = body;

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
    value: { agent: agent.trim(), vendor: vendor.trim(), amount, reason },
  };
}
