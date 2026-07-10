'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, policies, apiKeys } from '@/db';
import { generateKey } from '@/lib/keys';
import {
  FREE_TIER_POLICY_LIMIT,
  getCard,
  getOrgPlan,
  issueCard,
  listPolicies,
  resolveDecision,
  setCardStatus,
} from '@/lib/store';
import { getOrIssueCardForAgent } from '@/lib/cards';
import { authorizeCharge, type AuthorizationResult } from '@/lib/authorization';

/** Every dashboard mutation is scoped to the active Clerk org. */
async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error('Not signed in.');
  // Personal workspace (no org selected) still gets a tenant id so solo
  // users can use Velos without creating an organization.
  return { orgId: orgId ?? `user_${userId}`, userId };
}

function parseList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePolicyForm(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const monthlyBudget = Number(formData.get('monthlyBudget'));
  const autoApproveUnder = Number(formData.get('autoApproveUnder'));
  const allowedVendors = parseList(formData.get('allowedVendors'));
  const agents = parseList(formData.get('agents'));
  const isDefault = formData.get('isDefault') === 'on';

  const errors: string[] = [];
  if (!name) errors.push('Policy name is required.');
  if (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0)
    errors.push('Monthly budget must be a positive number.');
  if (!Number.isFinite(autoApproveUnder) || autoApproveUnder < 0)
    errors.push('Auto-approve threshold must be zero or a positive number.');
  if (Number.isFinite(monthlyBudget) && Number.isFinite(autoApproveUnder) && autoApproveUnder > monthlyBudget)
    errors.push('Auto-approve threshold cannot exceed the monthly budget.');
  if (allowedVendors.length === 0) errors.push('At least one allowed vendor is required.');

  return { errors, values: { name, monthlyBudget, autoApproveUnder, allowedVendors, agents, isDefault } };
}

/** Only one default per org: setting a new default clears the old one. */
async function clearDefault(orgId: string) {
  await db().update(policies).set({ isDefault: false }).where(and(eq(policies.orgId, orgId), eq(policies.isDefault, true)));
}

export async function createPolicy(_prev: { errors: string[] }, formData: FormData) {
  const { orgId } = await requireOrg();
  const { errors, values } = parsePolicyForm(formData);
  if (errors.length) return { errors };

  const plan = await getOrgPlan(orgId);
  if (plan === 'free') {
    const existing = await listPolicies(orgId);
    if (existing.length >= FREE_TIER_POLICY_LIMIT) {
      return {
        errors: [
          `The free plan includes ${FREE_TIER_POLICY_LIMIT} policy. Upgrade to Pro for unlimited policies.`,
        ],
      };
    }
  }

  // First policy for an org is the default no matter what the box said —
  // otherwise /evaluate has nothing to fall back to.
  const existing = await listPolicies(orgId);
  const isDefault = existing.length === 0 ? true : values.isDefault;
  if (isDefault) await clearDefault(orgId);

  await db().insert(policies).values({
    orgId,
    name: values.name,
    monthlyBudget: values.monthlyBudget.toFixed(2),
    autoApproveUnder: values.autoApproveUnder.toFixed(2),
    allowedVendors: values.allowedVendors,
    agents: values.agents,
    isDefault,
  });
  revalidatePath('/dashboard/policies');
  return { errors: [] };
}

export async function updatePolicy(_prev: { errors: string[] }, formData: FormData) {
  const { orgId } = await requireOrg();
  const id = String(formData.get('id') ?? '');
  const { errors, values } = parsePolicyForm(formData);
  if (!id) errors.push('Missing policy id.');
  if (errors.length) return { errors };

  if (values.isDefault) await clearDefault(orgId);
  await db()
    .update(policies)
    .set({
      name: values.name,
      monthlyBudget: values.monthlyBudget.toFixed(2),
      autoApproveUnder: values.autoApproveUnder.toFixed(2),
      allowedVendors: values.allowedVendors,
      agents: values.agents,
      isDefault: values.isDefault,
      updatedAt: new Date(),
    })
    .where(and(eq(policies.id, id), eq(policies.orgId, orgId)));
  revalidatePath('/dashboard/policies');
  return { errors: [] };
}

export async function deletePolicy(formData: FormData) {
  const { orgId } = await requireOrg();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db().delete(policies).where(and(eq(policies.id, id), eq(policies.orgId, orgId)));
  revalidatePath('/dashboard/policies');
}

export async function resolvePending(formData: FormData) {
  const { orgId, userId } = await requireOrg();
  const id = String(formData.get('id') ?? '');
  const verdict = String(formData.get('verdict') ?? '');
  if (!id || (verdict !== 'approved' && verdict !== 'denied')) return;
  await resolveDecision(orgId, id, verdict, userId);
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard');
}

export async function createApiKey(
  _prev: { key: string | null; errors: string[] },
  formData: FormData,
): Promise<{ key: string | null; errors: string[] }> {
  const { orgId } = await requireOrg();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { key: null, errors: ['Key name is required.'] };

  const { key, hash, prefix } = generateKey();
  await db().insert(apiKeys).values({ orgId, name, keyHash: hash, prefix });
  revalidatePath('/dashboard/keys');
  // Plaintext travels to the client exactly once, right here.
  return { key, errors: [] };
}

export async function revokeApiKey(formData: FormData) {
  const { orgId } = await requireOrg();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, orgId)));
  revalidatePath('/dashboard/keys');
}

// ── Cards ────────────────────────────────────────────────────────

export async function issueCardAction(formData: FormData) {
  const { orgId } = await requireOrg();
  const agent = String(formData.get('agent') ?? '').trim();
  if (!agent) return;
  await issueCard(orgId, agent);
  revalidatePath('/dashboard/cards');
}

export async function setCardFrozen(formData: FormData) {
  const { orgId } = await requireOrg();
  const id = String(formData.get('id') ?? '');
  const frozen = formData.get('frozen') === 'true';
  if (!id) return;
  const card = await getCard(orgId, id);
  if (!card) return;
  await setCardStatus(orgId, id, frozen ? 'frozen' : 'active');
  revalidatePath('/dashboard/cards');
}

/** Fire a synthetic card authorization at the enforcement gate from the UI. */
export async function simulateCharge(
  _prev: { result: AuthorizationResult | null; errors: string[] },
  formData: FormData,
): Promise<{ result: AuthorizationResult | null; errors: string[] }> {
  const { orgId } = await requireOrg();
  const agent = String(formData.get('agent') ?? '').trim();
  const merchant = String(formData.get('merchant') ?? '').trim();
  const amount = Number(formData.get('amount'));

  const errors: string[] = [];
  if (!agent) errors.push('Agent is required.');
  if (!merchant) errors.push('Merchant is required.');
  if (!Number.isFinite(amount) || amount <= 0) errors.push('Amount must be a positive number.');
  if (errors.length) return { result: null, errors };

  const card = await getOrIssueCardForAgent(orgId, agent);
  const authorizationId = `sim_auth_${crypto.randomUUID().slice(0, 12)}`;
  try {
    const result = await authorizeCharge(card, { amount, merchant, authorizationId });
    revalidatePath('/dashboard/cards');
    revalidatePath('/dashboard');
    return { result, errors: [] };
  } catch {
    return {
      result: {
        authorization: 'declined',
        decision: 'denied',
        explanation: 'Velos could not evaluate this charge, so it was declined (fail-closed).',
        decisionId: null,
        matchedIntent: false,
      },
      errors: [],
    };
  }
}
