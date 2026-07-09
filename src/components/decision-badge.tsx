import { decisionStatus } from '@/lib/status';
import type { Decision } from '@/db/schema';

const styles: Record<string, string> = {
  approved: 'bg-ok/10 text-ok',
  denied: 'bg-accent/10 text-accent',
  pending: 'bg-warn/10 text-warn',
};

const labels: Record<string, string> = {
  approved: 'approved',
  denied: 'denied',
  pending: 'pending',
};

export function DecisionBadge({ decision }: { decision: Pick<Decision, 'decision' | 'resolution'> }) {
  const status = decisionStatus(decision);
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
      {decision.decision === 'human_approval_required' && decision.resolution && (
        <span className="ml-1 font-normal normal-case opacity-70">by human</span>
      )}
    </span>
  );
}
