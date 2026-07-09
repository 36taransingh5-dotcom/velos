import { tenantId } from '@/lib/tenant';
import {
  FREE_TIER_DECISIONS_PER_MONTH,
  FREE_TIER_POLICY_LIMIT,
  getOrgPlan,
  monthlyDecisionCount,
} from '@/lib/store';
import { startCheckout, openPortal } from './actions';

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const orgId = await tenantId();
  const [plan, used, params] = await Promise.all([
    getOrgPlan(orgId),
    monthlyDecisionCount(orgId),
    searchParams,
  ]);

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-4xl">billing</h1>

      {params.upgraded && plan === 'pro' && (
        <p className="rounded-lg border border-ok/40 bg-ok/5 p-4 text-sm text-ok">
          Welcome to Pro — unlimited decisions and policies are live.
        </p>
      )}
      {params.upgraded && plan === 'free' && (
        <p className="rounded-lg border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
          Payment received — your plan will flip to Pro as soon as Stripe&apos;s webhook lands
          (usually seconds). Refresh in a moment.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div
          className={`rounded-lg border-2 bg-white p-8 ${plan === 'free' ? 'border-ink' : 'border-[#e6e2da]'}`}
        >
          <span className="tag-label">free</span>
          <p className="mt-2 font-serif text-4xl">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            <li>· {FREE_TIER_DECISIONS_PER_MONTH} decisions / month</li>
            <li>· {FREE_TIER_POLICY_LIMIT} policy</li>
            <li>· Full audit log</li>
            <li>· MCP server access</li>
          </ul>
          {plan === 'free' && (
            <p className="mt-4 font-mono text-xs text-ink/50">
              current plan · {used}/{FREE_TIER_DECISIONS_PER_MONTH} decisions used this month
            </p>
          )}
        </div>

        <div
          className={`rounded-lg border-2 bg-white p-8 ${plan === 'pro' ? 'border-ink' : 'border-[#e6e2da]'}`}
        >
          <span className="tag-label">pro</span>
          <p className="mt-2 font-serif text-4xl">
            $49<span className="text-lg text-ink/50">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            <li>· Unlimited decisions</li>
            <li>· Unlimited policies</li>
            <li>· Full audit log</li>
            <li>· MCP server access</li>
          </ul>
          {plan === 'pro' ? (
            <form action={openPortal} className="mt-6">
              <button className="rounded-full border border-ink px-6 py-2.5 font-medium transition-transform hover:scale-105">
                Manage subscription
              </button>
            </form>
          ) : (
            <form action={startCheckout} className="mt-6">
              <button className="rounded-full bg-pill px-6 py-2.5 font-medium text-white transition-transform hover:scale-105">
                Upgrade to Pro →
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
