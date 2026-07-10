'use client';

import { useActionState } from 'react';
import { simulateCharge } from '../actions';

const inputCls =
  'w-full rounded border border-[#d8d4ca] bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function ChargeSimulator({ agents }: { agents: string[] }) {
  const [state, formAction, pending] = useActionState(simulateCharge, {
    result: null as Awaited<ReturnType<typeof simulateCharge>>['result'],
    errors: [] as string[],
  });

  const r = state.result;
  const tone = !r
    ? ''
    : r.authorization === 'approved'
      ? 'border-ok/40 bg-ok/5 text-ok'
      : r.decision === 'human_approval_required'
        ? 'border-warn/40 bg-warn/5 text-warn'
        : 'border-accent/40 bg-accent/5 text-accent';

  return (
    <div className="rounded-lg border border-[#e6e2da] bg-white p-6">
      <h2 className="mb-1 font-mono text-sm uppercase tracking-wider text-ink/60">
        simulate a charge
      </h2>
      <p className="mb-4 text-sm text-ink/50">
        Fire a synthetic card authorization at the enforcement gate — the same path a real Stripe
        Issuing charge takes. Watch it approve or decline against your policy.
      </p>

      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-1">
          <span className="tag-label">agent</span>
          <input
            name="agent"
            list="agent-list"
            defaultValue={agents[0] ?? 'research-bot'}
            placeholder="research-bot"
            className={`mt-1 ${inputCls}`}
            required
          />
          <datalist id="agent-list">
            {agents.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="block sm:col-span-1">
          <span className="tag-label">merchant</span>
          <input name="merchant" defaultValue="OpenAI" className={`mt-1 ${inputCls}`} required />
        </label>
        <label className="block sm:col-span-1">
          <span className="tag-label">amount (usd)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue="42.50"
            className={`mt-1 ${inputCls}`}
            required
          />
        </label>
        <div className="flex items-end sm:col-span-1">
          <button
            disabled={pending}
            className="w-full rounded-full bg-pill px-5 py-2.5 font-medium text-white transition-transform hover:scale-105 disabled:opacity-50"
          >
            {pending ? 'Charging…' : 'Run charge'}
          </button>
        </div>
      </form>

      {state.errors.length > 0 && (
        <p className="mt-3 text-sm text-accent">{state.errors.join(' ')}</p>
      )}

      {r && (
        <div className={`mt-5 rounded-lg border p-4 ${tone}`}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold uppercase">
              {r.authorization === 'approved' ? 'authorized ✓' : 'declined ✗'}
            </span>
            {r.matchedIntent && (
              <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase text-ink/60">
                matched intent
              </span>
            )}
            {r.decision === 'human_approval_required' && (
              <span className="font-mono text-[11px] uppercase">→ sent to approvals</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink/70">{r.explanation}</p>
          {r.decision === 'human_approval_required' && (
            <p className="mt-2 text-xs text-ink/50">
              The live charge was declined. Approve it under{' '}
              <a href="/dashboard/approvals" className="underline">
                approvals
              </a>
              , then the agent&apos;s retry will authorize.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 font-mono text-[11px] text-ink/40">
        {usd(0)} risk — this is a simulated authorization. Wire Stripe Issuing to gate real cards.
      </p>
    </div>
  );
}
