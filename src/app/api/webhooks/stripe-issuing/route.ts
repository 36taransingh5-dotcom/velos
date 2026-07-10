import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { authorizeCharge } from '@/lib/authorization';
import { getCardByStripeId } from '@/lib/store';

export const runtime = 'nodejs';

/**
 * Real-time Stripe Issuing authorization webhook — the airtight gate.
 *
 * Stripe fires `issuing_authorization.request` the instant a Velos card is
 * charged and expects an approve/decline within ~2 seconds. We resolve the
 * card, run the same enforcement logic as the simulator, and respond.
 *
 * Dormant until STRIPE_SECRET_KEY + STRIPE_ISSUING_WEBHOOK_SECRET are set;
 * the simulator (/api/v1/simulate-charge) exercises the identical path today.
 *
 * Fail-closed: any error path declines the authorization.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe Issuing not configured. Use /api/v1/simulate-charge for now.' },
      { status: 501 },
    );
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

  if (event.type !== 'issuing_authorization.request') {
    return NextResponse.json({ received: true });
  }

  const authorization = event.data.object as Stripe.Issuing.Authorization;
  const stripeCardId =
    typeof authorization.card === 'string' ? authorization.card : authorization.card?.id;

  try {
    const card = stripeCardId ? await getCardByStripeId(stripeCardId) : null;
    if (!card) {
      // Unknown card → decline. Never approve something we can't govern.
      return NextResponse.json({ approved: false });
    }

    // Stripe amounts are in the smallest currency unit (cents).
    const amount = authorization.pending_request?.amount ?? authorization.amount;
    const result = await authorizeCharge(card, {
      amount: Math.abs(amount) / 100,
      merchant: authorization.merchant_data?.name ?? 'unknown merchant',
      authorizationId: authorization.id,
    });

    return NextResponse.json({ approved: result.authorization === 'approved' });
  } catch {
    return NextResponse.json({ approved: false });
  }
}
