import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Multi-tenant model
 * ──────────────────
 *   Clerk org (orgId string) ──┬── policies (many, one is_default)
 *                              ├── api_keys (hashed, prefix shown once)
 *                              ├── decisions (immutable audit log)
 *                              └── org_settings (plan + Stripe linkage)
 */

export const decisionEnum = pgEnum('decision', [
  'approved',
  'denied',
  'human_approval_required',
]);

export const resolutionEnum = pgEnum('resolution', ['approved', 'denied']);

export const planEnum = pgEnum('plan', ['free', 'pro']);

export const policies = pgTable(
  'policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    monthlyBudget: numeric('monthly_budget', { precision: 12, scale: 2 }).notNull(),
    autoApproveUnder: numeric('auto_approve_under', { precision: 12, scale: 2 }).notNull(),
    allowedVendors: text('allowed_vendors').array().notNull().default([]),
    // Agent IDs this policy applies to. Empty array = matches no specific
    // agent; the is_default policy catches anything unmatched.
    agents: text('agents').array().notNull().default([]),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('policies_org_idx').on(t.orgId)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    // SHA-256 of the full key. The plaintext key (vk_...) is shown once at
    // creation and never stored.
    keyHash: text('key_hash').notNull().unique(),
    // First 12 chars (vk_ + 8) kept for display in the dashboard.
    prefix: text('prefix').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('api_keys_org_idx').on(t.orgId)],
);

export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    policyId: uuid('policy_id'),
    // Denormalized so the audit row stays truthful even if the policy is
    // later renamed or deleted.
    policyName: text('policy_name').notNull(),
    agent: text('agent').notNull(),
    vendor: text('vendor').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason'),
    // What the engine said at evaluate time.
    decision: decisionEnum('decision').notNull(),
    explanation: text('explanation').notNull(),
    // For escalations: what the human decided. Null while pending and for
    // auto decisions. Budget counts decision='approved' OR resolution='approved'.
    resolution: resolutionEnum('resolution'),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('decisions_org_created_idx').on(t.orgId, t.createdAt),
    index('decisions_org_decision_idx').on(t.orgId, t.decision),
  ],
);

export const orgSettings = pgTable('org_settings', {
  orgId: text('org_id').primaryKey(),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type OrgSettings = typeof orgSettings.$inferSelect;
