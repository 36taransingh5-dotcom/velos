import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// DIAGNOSTIC BUILD: verify signature, then instantly approve. No DB work.
// If Stripe still reports webhook_error, the problem is mechanism/setup,
// not our latency. Revert to the real gate after this test.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'not configured' }, { status: 501 });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'no sig' }, { status: 400 });

  let event: Stripe.Event;
  try {
    const payload = await req.text();
    event = await stripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'bad sig' }, { status: 400 });
  }

  if (event.type === 'issuing_authorization.request') {
    return NextResponse.json({ approved: true });
  }
  return NextResponse.json({ received: true });
}
