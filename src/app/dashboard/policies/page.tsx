import { tenantId } from '@/lib/tenant';
import { listPolicies, monthToDateSpend } from '@/lib/store';
import { deletePolicy } from '../actions';
import { PolicyForm } from './policy-form';

export const dynamic = 'force-dynamic';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default async function PoliciesPage() {
  const orgId = await tenantId();
  const policies = await listPolicies(orgId);
  const spends = await Promise.all(policies.map((p) => monthToDateSpend(p.id)));

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-4xl">policies</h1>

      <section className="rounded-lg border border-[#e6e2da] bg-white p-6">
        <h2 className="mb-4 font-mono text-sm uppercase tracking-wider text-ink/60">new policy</h2>
        <PolicyForm />
      </section>

      <section className="space-y-4">
        {policies.map((p, i) => (
          <details key={p.id} className="group rounded-lg border border-[#e6e2da] bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <span className="font-medium">{p.name}</span>
                {p.isDefault && (
                  <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink/50">
                    default
                  </span>
                )}
                <p className="mt-1 font-mono text-xs text-ink/50">
                  {usd(Number(p.monthlyBudget))}/mo · auto-approve under{' '}
                  {usd(Number(p.autoApproveUnder))} · vendors: {p.allowedVendors.join(', ')}
                  {p.agents.length > 0 && <> · agents: {p.agents.join(', ')}</>}
                </p>
              </div>
              <span className="font-mono text-xs text-ink/50">
                {usd(spends[i])} spent this month · <span className="underline">edit</span>
              </span>
            </summary>
            <div className="border-t border-[#f1eee7] p-5">
              <PolicyForm policy={p} />
              <form action={deletePolicy} className="mt-4 border-t border-[#f1eee7] pt-4">
                <input type="hidden" name="id" value={p.id} />
                <button className="font-mono text-xs text-accent underline">
                  delete this policy
                </button>
              </form>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
