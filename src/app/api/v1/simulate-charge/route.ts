import { NextResponse } from 'next/server';
import { keyFromRequest, orgForKey } from '@/lib/keys';
import { authorizeCharge } from '@/lib/authorization';
import { getOrIssueCardForAgent } from '@/lib/cards';

export const runtime = 'nodejs';

/**
 * POST /api/v1/simulate-charge — fire a synthetic card authorization at the
 * enforcement gate, exactly as a real Stripe Issuing authorization would.
 * Lets you watch approve/decline live with no Stripe account.
 *
 * Body: { agent, merchant, amount }
 * Returns: { authorization, decision, explanation, card, ... }
 */
export async function POST(req: Request) {
  const key = keyFromRequest(req);
  if (!key) {
    return NextResponse.json(
      { errors: ['Missing or malformed Authorization header. Expected: Bearer vk_...'] },
      { status: 401 },
    );
  }
  const orgId = await orgForKey(key);
  if (!orgId) {
    return NextResponse.json({ errors: ['Invalid or revoked API key.'] }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ['Request body is not valid JSON.'] }, { status: 400 });
  }

  const { agent, merchant, amount } = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof agent !== 'string' || agent.trim() === '')
    errors.push('"agent" is required and must be a non-empty string.');
  if (typeof merchant !== 'string' || merchant.trim() === '')
    errors.push('"merchant" is required and must be a non-empty string.');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)
    errors.push('"amount" is required and must be a positive number.');
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const card = await getOrIssueCardForAgent(orgId, (agent as string).trim());
  const authorizationId = `sim_auth_${crypto.randomUUID().slice(0, 12)}`;

  // Fail-closed: if the gate itself errors, the network gets a decline.
  let result;
  try {
    result = await authorizeCharge(card, {
      amount: amount as number,
      merchant: (merchant as string).trim(),
      authorizationId,
    });
  } catch {
    return NextResponse.json(
      {
        authorization: 'declined',
        decision: 'denied',
        explanation: 'Velos could not evaluate this charge, so it was declined (fail-closed).',
        card: { last4: card.last4, agent: card.agent },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ...result,
    authorizationId,
    card: { id: card.id, last4: card.last4, agent: card.agent, status: card.status },
  });
}
