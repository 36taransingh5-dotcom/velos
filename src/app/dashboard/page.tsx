import Link from 'next/link';
import { tenantId } from '@/lib/tenant';
import {
  FREE_TIER_DECISIONS_PER_MONTH,
  getOrgPlan,
  listDecisions,
  listPolicies,
  monthlyDecisionCount,
  monthToDateSpend,
  pendingDecisions,
} from '@/lib/store';
import { DecisionBadge } from '@/components/decision-badge';

export const dynamic = 'force-dynamic';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function OverviewPage() {
  const orgId = await tenantId();
  const [plan, used, pending, recent, policies] = await Promise.all([
    getOrgPlan(orgId),
    monthlyDecisionCount(orgId),
    pendingDecisions(orgId),
    listDecisions(orgId, 15),
    listPolicies(orgId),
  ]);
  const spends = await Promise.all(policies.map((p) => monthToDateSpend(p.id)));

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl">overview</h1>
        <span className="font-mono text-xs text-ink/50">
          {plan === 'free'
            ? `free plan · ${used}/${FREE_TIER_DECISIONS_PER_MONTH} decisions this month`
            : 'pro plan · unlimited decisions'}
        </span>
      </div>

      {policies.length === 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-6">
          <p className="font-medium">
            No policies yet — agents can&apos;t spend until one exists.{' '}
            <Link className="text-accent underline" href="/dashboard/policies">
              Create your first policy →
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#e6e2da] bg-white p-6">
          <span className="tag-label">decisions this month</span>
          <p className="mt-2 font-serif text-4xl">{used}</p>
        </div>
        <Link
          href="/dashboard/approvals"
          className="rounded-lg border border-[#e6e2da] bg-white p-6 transition-shadow hover:shadow-lg"
        >
          <span className="tag-label">awaiting human approval</span>
          <p className={`mt-2 font-serif text-4xl ${pending.length > 0 ? 'text-warn' : ''}`}>
            {pending.length}
          </p>
        </Link>
        <div className="rounded-lg border border-[#e6e2da] bg-white p-6">
          <span className="tag-label">active policies</span>
          <p className="mt-2 font-serif text-4xl">{policies.length}</p>
        </div>
      </div>

      {policies.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-sm uppercase tracking-wider text-ink/60">
            budgets
          </h2>
          <div className="space-y-3">
            {policies.map((p, i) => {
              const budget = Number(p.monthlyBudget);
              const spent = spends[i];
              const pct = Math.min(100, (spent / budget) * 100);
              return (
                <div key={p.id} className="rounded-lg border border-[#e6e2da] bg-white p-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-medium">
                      {p.name}
                      {p.isDefault && (
                        <span className="ml-2 font-mono text-[10px] uppercase text-ink/40">
                          default
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-ink/60">
                      {usd(spent)} / {usd(budget)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#efece5]">
                    <div
                      className={`h-full rounded-full ${pct >= 90 ? 'bg-accent' : pct >= 70 ? 'bg-warn' : 'bg-ok'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-mono text-sm uppercase tracking-wider text-ink/60">
          recent decisions
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#d8d4ca] p-8 text-center text-sm text-ink/50">
            No decisions yet. Point an agent at{' '}
            <code className="font-mono text-xs">POST /api/v1/evaluate</code> and they&apos;ll appear
            here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#e6e2da] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e2da] text-left font-mono text-[11px] uppercase tracking-wider text-ink/50">
                  <th className="px-4 py-3">when</th>
                  <th className="px-4 py-3">agent</th>
                  <th className="px-4 py-3">vendor</th>
                  <th className="px-4 py-3 text-right">amount</th>
                  <th className="px-4 py-3">verdict</th>
                  <th className="px-4 py-3">explanation</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-b border-[#f1eee7] last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink/50">
                      {d.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.agent}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${d.source === 'card' ? 'bg-sky-mid/15 text-sky-mid' : 'bg-ink/5 text-ink/40'}`}
                      >
                        {d.source === 'card' ? 'card' : 'api'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{d.vendor}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{usd(Number(d.amount))}</td>
                    <td className="px-4 py-3">
                      <DecisionBadge decision={d} />
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-ink/60">{d.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
