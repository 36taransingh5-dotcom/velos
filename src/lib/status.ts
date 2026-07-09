import type { Decision } from '@/db/schema';

/**
 * Collapse (decision, resolution) into the single status agents poll for:
 *
 *   decision            resolution   status
 *   ─────────────────── ──────────── ─────────
 *   approved            —            approved
 *   denied              —            denied
 *   human_approval_req  null         pending
 *   human_approval_req  approved     approved
 *   human_approval_req  denied       denied
 */
export function decisionStatus(
  d: Pick<Decision, 'decision' | 'resolution'>,
): 'approved' | 'denied' | 'pending' {
  if (d.decision === 'human_approval_required') {
    return d.resolution ?? 'pending';
  }
  return d.decision;
}
