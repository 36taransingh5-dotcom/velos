import { NextResponse } from 'next/server';
import { keyFromRequest, orgForKey } from '@/lib/keys';
import { resolveDecision } from '@/lib/store';
import { decisionStatus } from '@/lib/status';

export const runtime = 'nodejs';

/**
 * POST /api/v1/decisions/:id/resolve — approve or deny a pending escalation
 * from the agent side (the human approves inside the agent's own UI instead
 * of the Velos dashboard). Body: { "verdict": "approved" | "denied" }.
 *
 * Auth: Bearer vk_...  The approver is recorded as the key prefix so the
 * audit log shows an API approval vs a dashboard (user) approval.
 *
 *   200 { id, status, resolution, ... }
 *   400 bad verdict / id
 *   401 bad key
 *   404 not found or not awaiting approval (already resolved / not escalated)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ['Request body is not valid JSON.'] }, { status: 400 });
  }
  const verdict = (body as Record<string, unknown>)?.verdict;
  if (verdict !== 'approved' && verdict !== 'denied') {
    return NextResponse.json(
      { errors: ['"verdict" is required and must be "approved" or "denied".'] },
      { status: 400 },
    );
  }

  const row = await resolveDecision(orgId, id, verdict, `api:${key.slice(0, 12)}`);
  if (!row) {
    return NextResponse.json(
      { errors: ['Decision not found, or it is not awaiting human approval.'] },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: row.id,
    status: decisionStatus(row),
    resolution: row.resolution,
    resolved_by: row.resolvedBy,
    resolved_at: row.resolvedAt,
  });
}
