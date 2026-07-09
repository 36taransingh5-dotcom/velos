# Velos

The financial control layer that lets companies safely give AI agents spending power. Velos is **not** a payment processor — it's a policy engine. An agent asks before it spends; Velos answers approved, denied, or human approval required, explains why, and keeps an audit log.

> **MVP status:** Velos is currently *advisory* — it returns a verdict, but enforcement is up to the calling payment system. Inline enforcement is on the roadmap.

## Quick start

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`. Configure the policy in [policy.json](policy.json).

## API

### `POST /evaluate`

Ask Velos whether an agent may spend.

```bash
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d '{"agent": "research-bot", "vendor": "OpenAI", "amount": 42.50, "reason": "API credits for embeddings"}'
```

```json
{
  "id": 1,
  "decision": "approved",
  "policy": "Default Policy",
  "explanation": "Auto-approved: $42.50 is under the $100.00 auto-approval threshold and within budget.",
  "created_at": "2026-07-09T18:00:00.000Z"
}
```

Decisions, first match wins:

1. Vendor not on `allowed_vendors` → **denied**
2. Amount exceeds remaining monthly budget → **denied**
3. Amount under `auto_approve_under` → **approved**
4. Otherwise → **human_approval_required**

Approved amounts count against the monthly budget immediately.

Invalid input (missing agent/vendor, non-positive amount, malformed JSON) returns `400` with an `errors` array.

### `GET /decisions`

Audit log — last 100 decisions, newest first.

### `GET /policy`

Current policy plus live `month_to_date_spend` and `remaining_budget`.

## Tests

```bash
npm test
```

## Deploying

The app is split so it runs the same way locally and on Vercel:

- [src/app.js](src/app.js) — the Express app (routes, no `listen()`).
- [src/server.js](src/server.js) — local dev entry, calls `app.listen()`. Used by `npm start`.
- [api/index.js](api/index.js) — Vercel serverless entry, wraps the same app as a function handler.
- [public/](public) — the landing page. Vercel serves this directory as static/CDN content automatically; Express serves it the same way locally.
- [vercel.json](vercel.json) — rewrites `/evaluate`, `/decisions`, `/policy` to the serverless function (everything else falls through to `public/`).

Push to a branch connected to a Vercel project and it deploys with no other config.

**Audit log persistence on Vercel:** serverless functions have a read-only filesystem outside `/tmp`, and `/tmp` is wiped between cold starts and not shared across concurrent instances. The SQLite audit log still works — reads and writes succeed — but on Vercel it's only reliable *within a single warm invocation*, not as a durable log across requests. Locally (`npm start`), the same file (`velos.db`) persists normally on disk. For a production audit log that needs to survive across serverless instances, swap `src/db.js` for a hosted database (Vercel Postgres, Turso, Neon, etc.) — the `createDb`/`insertDecision`/`monthToDateSpend`/`listDecisions` functions are the only place that would need to change.
