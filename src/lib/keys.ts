import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, apiKeys } from '@/db';

/**
 * API keys: `vk_` + 40 hex chars. Plaintext is returned exactly once at
 * creation; only the SHA-256 lands in the database.
 */
export function generateKey(): { key: string; hash: string; prefix: string } {
  const key = `vk_${randomBytes(20).toString('hex')}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, 12) };
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Resolve a bearer key to its org. Null = invalid or revoked. */
export async function orgForKey(key: string): Promise<string | null> {
  if (!key.startsWith('vk_')) return null;
  const [row] = await db()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(key)), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  // Fire-and-forget freshness marker; failure here must not fail the request.
  db()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});
  return row.orgId;
}

export function keyFromRequest(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(vk_[a-f0-9]{40})$/i);
  return match ? match[1] : null;
}
