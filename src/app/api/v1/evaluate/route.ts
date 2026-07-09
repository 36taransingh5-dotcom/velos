import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/engine';
import { keyFromRequest, orgForKey } from '@/lib/keys';
import { evaluateForOrg } from '@/lib/evaluate-service';

export const runtime = 'nodejs';

/**
 * POST /api/v1/evaluate — the product's front door.
 *
 *   agent ── Authorization: Bearer vk_... ──► org ──► policy ──► verdict
 *
 * Responses:
 *   200 { id, decision, policy, explanation, created_at }
 *   400 { errors: [...] }          — malformed input
 *   401 { errors: [...] }          — missing/invalid API key
 *   402 { errors: [...] }          — free-tier decision limit reached
 *   422 { errors: [...] }          — org has no matching policy
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

  const validation = validateRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const outcome = await evaluateForOrg(orgId, validation.value);
  if (!outcome.ok) {
    return NextResponse.json({ errors: outcome.errors }, { status: outcome.status });
  }
  return NextResponse.json(outcome.result);
}
