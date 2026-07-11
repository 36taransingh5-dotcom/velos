import { NextResponse, after } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { decideCharge } from '@/lib/authorization';
import { getCardByStripeId } from '@/lib/store';

export const runtime = 'nodejs';

// Fallback API version if the event doesn't carry one (matches the SDK).
const FALLBACK_STRIPE_VERSION = '2026-06-24.dahlia';

/**
 * Real-time Stripe Issuing authorization webhook — the airtight gate.
 *
 * Stripe fires `issuing_authorization.request` the instant a Velos card is
 * charged and expects an approve/decline within ~2 seconds. We resolve the
 * card, run the enforcement engine, and respond.
 *
 * CRITICAL: the response MUST carry a `Stripe-Version` header matching a
 * supported API version, or Stripe declines with reason `webhook_error`.
 *
 * Dormant until STRIPE_SECRET_KEY + STRIPE_ISSUING_WEBHOOK_SECRET are set.
 * Fail-closed: any error path declines.
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

  // Stripe reads the decision from a JSON body AND requires a valid
  // Stripe-Version response header. Echo the event's version.
  const stripeVersion = event.api_version ?? FALLBACK_STRIPE_VERSION;
  const respond = (approved: boolean) =>
    new NextResponse(JSON.stringify({ approved }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Stripe-Version': stripeVersion },
    });

  if (event.type !== 'issuing_authorization.request') {
    return NextResponse.json({ received: true });
  }

  const authorization = event.data.object as Stripe.Issuing.Authorization;
  const stripeCardId =
    typeof authorization.card === 'string' ? authorization.card : authorization.card?.id;

  try {
    const card = stripeCardId ? await getCardByStripeId(stripeCardId) : null;
    if (!card) return respond(false); // unknown card → decline

    const amount = authorization.pending_request?.amount ?? authorization.amount;
    const { result, commit } = await decideCharge(card, {
      amount: Math.abs(amount) / 100,
      merchant: authorization.merchant_data?.name ?? 'unknown merchant',
      authorizationId: authorization.id,
    });

    after(commit); // audit write, off the response path
    return respond(result.authorization === 'approved');
  } catch {
    return respond(false); // fail-closed
  }
}
