import { eq } from 'drizzle-orm';
import { db, apiKeys } from '@/db';
import { tenantId } from '@/lib/tenant';
import { revokeApiKey } from '../actions';
import { KeyCreator } from './key-creator';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const orgId = await tenantId();
  const keys = await db()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(apiKeys.createdAt);

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-4xl">api keys</h1>

      <section className="rounded-lg border border-[#e6e2da] bg-white p-6">
        <h2 className="mb-4 font-mono text-sm uppercase tracking-wider text-ink/60">
          create a key
        </h2>
        <KeyCreator />
      </section>

      <section className="overflow-x-auto rounded-lg border border-[#e6e2da] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6e2da] text-left font-mono text-[11px] uppercase tracking-wider text-ink/50">
              <th className="px-4 py-3">name</th>
              <th className="px-4 py-3">key</th>
              <th className="px-4 py-3">created</th>
              <th className="px-4 py-3">last used</th>
              <th className="px-4 py-3">status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-ink/50">
                  No keys yet — create one above and drop it into your agent.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-[#f1eee7] last:border-0">
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{k.prefix}…</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/50">
                  {k.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/50">
                  {k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 16).replace('T', ' ') : 'never'}
                </td>
                <td className="px-4 py-3">
                  {k.revokedAt ? (
                    <span className="font-mono text-[11px] uppercase text-ink/40">revoked</span>
                  ) : (
                    <span className="font-mono text-[11px] uppercase text-ok">active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!k.revokedAt && (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="font-mono text-xs text-accent underline">revoke</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="rounded-lg border border-[#e6e2da] bg-ink p-6 font-mono text-xs leading-relaxed text-white/80">
        <p className="mb-2 text-white/50"># point your agent at velos</p>
        <p>
          curl -X POST {process.env.NEXT_PUBLIC_APP_URL ?? 'https://velos-chi.vercel.app'}
          /api/v1/evaluate \
        </p>
        <p className="pl-4">-H &quot;Authorization: Bearer vk_...&quot; \</p>
        <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
        <p className="pl-4">
          -d &apos;{'{'}&quot;agent&quot;: &quot;research-bot&quot;, &quot;vendor&quot;:
          &quot;OpenAI&quot;, &quot;amount&quot;: 42.5{'}'}&apos;
        </p>
      </div>
    </div>
  );
}
