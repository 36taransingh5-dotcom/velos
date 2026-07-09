import { NextResponse } from 'next/server';
import { keyFromRequest, orgForKey } from '@/lib/keys';
import { listDecisions } from '@/lib/store';
import { decisionStatus } from '@/lib/status';

export const runtime = 'nodejs';

/** GET /api/v1/decisions — audit log, newest first, max 100. */
export async function GET(req: Request) {
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

  const rows = await listDecisions(orgId);
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      status: decisionStatus(row),
      decision: row.decision,
      resolution: row.resolution,
      policy: row.policyName,
      agent: row.agent,
      vendor: row.vendor,
      amount: Number(row.amount),
      reason: row.reason,
      explanation: row.explanation,
      created_at: row.createdAt,
      resolved_at: row.resolvedAt,
    })),
  );
}
