import { tenantId } from '@/lib/tenant';
import { pendingDecisions } from '@/lib/store';
import { resolvePending } from '../actions';

export const dynamic = 'force-dynamic';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function ApprovalsPage() {
  const orgId = await tenantId();
  const pending = await pendingDecisions(orgId);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">approvals</h1>

      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d8d4ca] p-10 text-center text-sm text-ink/50">
          Queue is clear — nothing waiting on a human.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map((d) => (
            <div key={d.id} className="rounded-lg border border-[#e6e2da] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-baseline gap-3">
                    <span className="font-serif text-2xl">{usd(Number(d.amount))}</span>
                    <span className="text-ink/70">to {d.vendor}</span>
                  </div>
                  <p className="font-mono text-xs text-ink/50">
                    agent {d.agent} · policy {d.policyName} ·{' '}
                    {d.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
                  </p>
                  {d.reason && <p className="mt-2 text-sm text-ink/70">“{d.reason}”</p>}
                  <p className="mt-2 text-xs text-ink/50">{d.explanation}</p>
                </div>
                <div className="flex gap-2">
                  <form action={resolvePending}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="verdict" value="approved" />
                    <button className="rounded-full bg-pill px-5 py-2 font-medium text-white transition-transform hover:scale-105">
                      Approve
                    </button>
                  </form>
                  <form action={resolvePending}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="verdict" value="denied" />
                    <button className="rounded-full border border-accent px-5 py-2 font-medium text-accent transition-transform hover:scale-105">
                      Deny
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="font-mono text-xs text-ink/40">
        Agents poll <code>GET /api/v1/decisions/:id</code> — your verdict lands on their next poll.
      </p>
    </div>
  );
}
