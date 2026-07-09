import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Neon over HTTP: each query is a fetch, which is exactly right for
// serverless — no connection pool to leak across invocations.
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  return drizzle(neon(url), { schema });
}

// Lazy singleton so importing this module doesn't explode at build time
// when DATABASE_URL isn't available (e.g. next build on CI).
let _db: ReturnType<typeof createClient> | null = null;

export function db() {
  if (!_db) _db = createClient();
  return _db;
}

export * from './schema';
