'use client';

import { useActionState } from 'react';
import type { Policy } from '@/db/schema';
import { createPolicy, updatePolicy } from '../actions';

const inputCls =
  'w-full rounded border border-[#d8d4ca] bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none';

export function PolicyForm({ policy }: { policy?: Policy }) {
  const action = policy ? updatePolicy : createPolicy;
  const [state, formAction, isPending] = useActionState(action, { errors: [] });

  return (
    <form action={formAction} className="space-y-4">
      {policy && <input type="hidden" name="id" value={policy.id} />}

      {state.errors.length > 0 && (
        <ul className="rounded border border-accent/40 bg-accent/5 p-3 text-sm text-accent">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="tag-label">policy name</span>
          <input
            name="name"
            defaultValue={policy?.name}
            placeholder="Marketing Budget"
            className={`mt-1 ${inputCls}`}
            required
          />
        </label>
        <label className="block">
          <span className="tag-label">monthly budget (usd)</span>
          <input
            name="monthlyBudget"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={policy ? Number(policy.monthlyBudget) : 2000}
            className={`mt-1 ${inputCls}`}
            required
          />
        </label>
        <label className="block">
          <span className="tag-label">auto-approve under (usd)</span>
          <input
            name="autoApproveUnder"
            type="number"
            step="0.01"
            min="0"
            defaultValue={policy ? Number(policy.autoApproveUnder) : 100}
            className={`mt-1 ${inputCls}`}
            required
          />
        </label>
        <label className="block">
          <span className="tag-label">allowed vendors (comma-separated)</span>
          <input
            name="allowedVendors"
            defaultValue={policy?.allowedVendors.join(', ')}
            placeholder="OpenAI, Anthropic, ElevenLabs"
            className={`mt-1 ${inputCls}`}
            required
          />
        </label>
        <label className="block">
          <span className="tag-label">assigned agents (comma-separated, optional)</span>
          <input
            name="agents"
            defaultValue={policy?.agents.join(', ')}
            placeholder="research-bot, growth-bot"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={policy?.isDefault}
            className="h-4 w-4 accent-[#e8412c]"
          />
          <span className="text-sm">
            Default policy <span className="text-ink/50">(catches unassigned agents)</span>
          </span>
        </label>
      </div>

      <button
        disabled={isPending}
        className="rounded-full bg-pill px-6 py-2.5 font-medium text-white transition-transform hover:scale-105 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : policy ? 'Save changes' : 'Create policy'}
      </button>
    </form>
  );
}
