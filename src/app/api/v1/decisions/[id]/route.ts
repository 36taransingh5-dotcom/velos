import { NextResponse } from 'next/server';
import { keyFromRequest, orgForKey } from '@/lib/keys';
import { getDecision } from '@/lib/store';
import { decisionStatus } from '@/lib/status';

export const runtime = 'nodejs';

/**
 * GET /api/v1/decisions/:id — polling endpoint for escalated spends.
 * status: approved | denied | pending
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ errors: ['"id" must be a decision UUID.'] }, { status: 400 });
  }

  const row = await getDecision(orgId, id);
  if (!row) {
    return NextResponse.json({ errors: ['Decision not found.'] }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    status: decisionStatus(row),
    decision: row.decision,
    resolution: row.resolution,
    policy: row.policyName,
    agent: row.agent,
    vendor: row.vendor,
    amount: Number(row.amount),
    explanation: row.explanation,
    created_at: row.createdAt,
    resolved_at: row.resolvedAt,
  });
}
