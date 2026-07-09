import { and, desc, eq, gte, or, sql, count } from 'drizzle-orm';
import { db, decisions, policies, orgSettings, type NewDecision } from '@/db';

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

export const FREE_TIER_DECISIONS_PER_MONTH = 500;
export const FREE_TIER_POLICY_LIMIT = 1;
