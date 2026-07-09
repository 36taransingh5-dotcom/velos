'use client';

import { useActionState } from 'react';
import { createApiKey } from '../actions';

export function KeyCreator() {
  const [state, formAction, isPending] = useActionState(createApiKey, {
    key: null,
    errors: [],
  });

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="block grow sm:max-w-xs">
          <span className="tag-label">key name</span>
          <input
            name="name"
            placeholder="production"
            className="mt-1 w-full rounded border border-[#d8d4ca] bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            required
          />
        </label>
        <button
          disabled={isPending}
          className="rounded-full bg-pill px-6 py-2.5 font-medium text-white transition-transform hover:scale-105 disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {state.errors.length > 0 && (
        <p className="text-sm text-accent">{state.errors.join(' ')}</p>
      )}

      {state.key && (
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-4">
          <p className="mb-2 text-sm font-medium text-warn">
            Copy this key now — it will never be shown again.
          </p>
          <code className="block select-all break-all rounded bg-ink px-3 py-2 font-mono text-sm text-white">
            {state.key}
          </code>
        </div>
      )}
    </div>
  );
}
