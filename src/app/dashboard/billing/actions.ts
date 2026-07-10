'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { db, orgSettings } from '@/db';
import { stripe, appUrl } from '@/lib/stripe';
import { getOrgPlan, setOrgPlan, stripeConfigured } from '@/lib/store';

async function requireOrg(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error('Not signed in.');
  return orgId ?? `user_${userId}`;
}

/**
 * Dev-only plan toggle so plan gating is testable before Stripe is wired.
 * Refuses to run once a real Stripe key is present — then billing must flow
 * through Checkout so plan state stays in sync with the subscription.
 */
export async function devTogglePlan() {
  if (stripeConfigured()) return;
  const orgId = await requireOrg();
  const current = await getOrgPlan(orgId);
  await setOrgPlan(orgId, current === 'pro' ? 'free' : 'pro');
  revalidatePath('/dashboard/billing');
  revalidatePath('/dashboard');
}

async function settingsFor(orgId: string) {
  const [row] = await db().select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
  if (row) return row;
  const [created] = await db().insert(orgSettings).values({ orgId }).returning();
  return created;
}

/** Kick off Stripe Checkout for the Pro subscription. */
export async function startCheckout() {
  const orgId = await requireOrg();
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRO_PRICE_ID is not set.');

  const settings = await settingsFor(orgId);

  let customerId = settings.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({ metadata: { orgId } });
    customerId = customer.id;
    await db()
      .update(orgSettings)
      .set({ stripeCustomerId: customerId })
      .where(eq(orgSettings.orgId, orgId));
  }

  const session = await stripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/dashboard/billing?upgraded=1`,
    cancel_url: `${appUrl()}/dashboard/billing`,
    metadata: { orgId },
  });

  redirect(session.url!);
}

/** Send an existing Pro customer to the Stripe customer portal. */
export async function openPortal() {
  const orgId = await requireOrg();
  const settings = await settingsFor(orgId);
  if (!settings.stripeCustomerId) throw new Error('No Stripe customer for this org.');

  const session = await stripe().billingPortal.sessions.create({
    customer: settings.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/billing`,
  });

  redirect(session.url);
}
