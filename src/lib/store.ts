import { and, desc, eq, gte, isNull, or, sql, count } from 'drizzle-orm';
import {
  db,
  decisions,
  policies,
  orgSettings,
  agentCards,
  type NewDecision,
} from '@/db';

/**
 * Month-to-date approved spend for a policy (UTC calendar month).
 * Auto-approved AND human-approved escalations both count; pending
 * escalations do not reserve budget.
 */
export async function monthToDateSpend(policyId: string): Promise<number> {
  const monthStart = sql`date_trunc('month', now() at time zone 'utc')`;
  const [row] = await db()
    .select({ total: sql<string>`coalesce(sum(${decisions.amount}), 0)` })
    .from(decisions)
    .where(
      and(
        eq(decisions.policyId, policyId),
        gte(decisions.createdAt, monthStart),
        or(eq(decisions.decision, 'approved'), eq(decisions.resolution, 'approved')),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Decisions recorded this month for an org — the free-tier meter. */
export async function monthlyDecisionCount(orgId: string): Promise<number> {
  const monthStart = sql`date_trunc('month', now() at time zone 'utc')`;
  const [row] = await db()
    .select({ n: count() })
    .from(decisions)
    .where(and(eq(decisions.orgId, orgId), gte(decisions.createdAt, monthStart)));
  return row?.n ?? 0;
}

export async function recordDecision(values: NewDecision) {
  const [row] = await db().insert(decisions).values(values).returning();
  return row;
}

export async function listPolicies(orgId: string) {
  return db().select().from(policies).where(eq(policies.orgId, orgId)).orderBy(policies.createdAt);
}

export async function listDecisions(orgId: string, limit = 100) {
  return db()
    .select()
    .from(decisions)
    .where(eq(decisions.orgId, orgId))
    .orderBy(desc(decisions.createdAt))
    .limit(limit);
}

export async function getDecision(orgId: string, id: string) {
  const [row] = await db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.orgId, orgId), eq(decisions.id, id)));
  return row ?? null;
}

export async function pendingDecisions(orgId: string) {
  return db()
    .select()
    .from(decisions)
    .where(
      and(
        eq(decisions.orgId, orgId),
        eq(decisions.decision, 'human_approval_required'),
        sql`${decisions.resolution} is null`,
      ),
    )
    .orderBy(desc(decisions.createdAt));
}

/** Human verdict on an escalated decision. Only fills a still-pending row. */
export async function resolveDecision(
  orgId: string,
  id: string,
  resolution: 'approved' | 'denied',
  resolvedBy: string,
) {
  const [row] = await db()
    .update(decisions)
    .set({ resolution, resolvedBy, resolvedAt: new Date() })
    .where(
      and(
        eq(decisions.orgId, orgId),
        eq(decisions.id, id),
        eq(decisions.decision, 'human_approval_required'),
        sql`${decisions.resolution} is null`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function getOrgPlan(orgId: string): Promise<'free' | 'pro'> {
  const [row] = await db().select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
  return row?.plan ?? 'free';
}

/** Upsert an org's plan. Used by the Stripe webhook and the dev toggle. */
export async function setOrgPlan(orgId: string, plan: 'free' | 'pro') {
  await db()
    .insert(orgSettings)
    .values({ orgId, plan })
    .onConflictDoUpdate({ target: orgSettings.orgId, set: { plan } });
}

/** Stripe is only "configured" once a secret key is present. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const FREE_TIER_DECISIONS_PER_MONTH = 500;
export const FREE_TIER_POLICY_LIMIT = 1;

// ── Cards ────────────────────────────────────────────────────────

export async function listCards(orgId: string) {
  return db()
    .select()
    .from(agentCards)
    .where(eq(agentCards.orgId, orgId))
    .orderBy(agentCards.createdAt);
}

export async function getCard(orgId: string, id: string) {
  const [row] = await db()
    .select()
    .from(agentCards)
    .where(and(eq(agentCards.orgId, orgId), eq(agentCards.id, id)));
  return row ?? null;
}

export async function getCardByStripeId(stripeCardId: string) {
  const [row] = await db()
    .select()
    .from(agentCards)
    .where(eq(agentCards.stripeCardId, stripeCardId));
  return row ?? null;
}

export async function issueCard(orgId: string, agent: string) {
  const last4 = String(Math.floor(1000 + Math.random() * 9000));
  const [row] = await db()
    .insert(agentCards)
    .values({
      orgId,
      agent,
      last4,
      // Synthetic id until real Stripe Issuing is connected.
      stripeCardId: `sim_${crypto.randomUUID().slice(0, 12)}`,
    })
    .returning();
  return row;
}

export async function setCardStatus(orgId: string, id: string, status: 'active' | 'frozen') {
  await db()
    .update(agentCards)
    .set({ status })
    .where(and(eq(agentCards.orgId, orgId), eq(agentCards.id, id)));
}

// ── Intent matching ──────────────────────────────────────────────

// How long an approved /evaluate intent stays matchable by a live charge.
export const INTENT_WINDOW_SECONDS = 180;

/**
 * Find a recent approved 'api' intent that matches a live charge on
 * (org, agent, amount) and hasn't already been settled by another charge.
 * Approved = auto-approved OR human-approved. Newest first.
 */
export async function findMatchingIntent(
  orgId: string,
  agent: string,
  amount: number,
) {
  const windowStart = sql`now() - interval '${sql.raw(String(INTENT_WINDOW_SECONDS))} seconds'`;
  const [row] = await db()
    .select()
    .from(decisions)
    .where(
      and(
        eq(decisions.orgId, orgId),
        eq(decisions.agent, agent),
        eq(decisions.source, 'api'),
        eq(decisions.amount, amount.toFixed(2)),
        isNull(decisions.matchedAt),
        or(eq(decisions.decision, 'approved'), eq(decisions.resolution, 'approved')),
        gte(decisions.createdAt, windowStart),
      ),
    )
    .orderBy(desc(decisions.createdAt))
    .limit(1);
  return row ?? null;
}

/** Settle an intent against a live charge (no new budget-counting row). */
export async function settleIntent(intentId: string, authorizationId: string) {
  await db()
    .update(decisions)
    .set({ authorizationId, matchedAt: new Date() })
    .where(eq(decisions.id, intentId));
}
