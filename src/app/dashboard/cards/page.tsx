import { tenantId } from '@/lib/tenant';
import { listCards, listPolicies } from '@/lib/store';
import { issueCardAction, setCardFrozen } from '../actions';
import { ChargeSimulator } from './charge-simulator';

export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const orgId = await tenantId();
  const [cards, policies] = await Promise.all([listCards(orgId), listPolicies(orgId)]);

  // Suggest agents from existing cards + policy assignments for the simulator.
  const agents = Array.from(
    new Set([...cards.map((c) => c.agent), ...policies.flatMap((p) => p.agents)]),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-4xl">cards</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">
          Each agent holds a Velos-issued virtual card instead of real money. Every charge on it
          routes through the enforcement gate — approved, declined, or held for a human — using the
          same policy engine as the API.
        </p>
      </div>

      <ChargeSimulator agents={agents} />

      <section className="rounded-lg border border-[#e6e2da] bg-white p-6">
        <h2 className="mb-4 font-mono text-sm uppercase tracking-wider text-ink/60">issue a card</h2>
        <form action={issueCardAction} className="flex flex-wrap items-end gap-3">
          <label className="block grow sm:max-w-xs">
            <span className="tag-label">agent</span>
            <input
              name="agent"
              placeholder="research-bot"
              className="mt-1 w-full rounded border border-[#d8d4ca] bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              required
            />
          </label>
          <button className="rounded-full bg-pill px-6 py-2.5 font-medium text-white transition-transform hover:scale-105">
            Issue virtual card
          </button>
        </form>
      </section>

      <section className="overflow-x-auto rounded-lg border border-[#e6e2da] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6e2da] text-left font-mono text-[11px] uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3">agent</th>
              <th className="px-4 py-3">card</th>
              <th className="px-4 py-3">issued</th>
              <th className="px-4 py-3">status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-ink/50">
                  No cards yet. Issue one above, or just run a charge — a card is minted on first
                  use.
                </td>
              </tr>
            )}
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-[#f1eee7] last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{c.agent}</td>
                <td className="px-4 py-3 font-mono text-xs">•••• {c.last4}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/50">
                  {c.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  {c.status === 'active' ? (
                    <span className="font-mono text-[11px] uppercase text-ok">active</span>
                  ) : (
                    <span className="font-mono text-[11px] uppercase text-warn">frozen</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={setCardFrozen}>
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      type="hidden"
                      name="frozen"
                      value={c.status === 'active' ? 'true' : 'false'}
                    />
                    <button className="font-mono text-xs text-accent underline">
                      {c.status === 'active' ? 'freeze' : 'unfreeze'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
