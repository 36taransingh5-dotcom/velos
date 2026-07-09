import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db, orgSettings } from '@/db';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * Stripe → Velos plan sync.
 *
 *   checkout.session.completed ──► plan: pro
 *   customer.subscription.deleted ──► plan: free
 *
 * Signature-verified; unknown events are acknowledged and ignored.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await req.text();
    event = await stripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orgId = session.metadata?.orgId;
      if (orgId && session.subscription) {
        await db()
          .update(orgSettings)
          .set({
            plan: 'pro',
            stripeSubscriptionId: String(session.subscription),
          })
          .where(eq(orgSettings.orgId, orgId));
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = String(sub.customer);
      await db()
        .update(orgSettings)
        .set({ plan: 'free', stripeSubscriptionId: null })
        .where(eq(orgSettings.stripeCustomerId, customerId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
