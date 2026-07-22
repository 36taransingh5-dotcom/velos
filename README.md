# Velos

The financial control layer for AI agents. Velos sits between agents and money: every spending request passes through `POST /api/v1/evaluate`, gets an approved / denied / human-approval-required verdict with a plain-English explanation, and lands in an immutable audit log. Beyond that advisory check, Velos can also gate real charges: each agent gets a virtual card, and every authorization is approved or declined in real time by the same policy engine.

**Multi-tenant SaaS**: sign up, create policies, mint API keys, point your agents at the API (or the built-in MCP server).

## Stack

- **Next.js App Router** — dashboard + API in one deploy (Vercel)
- **Clerk** — auth with organizations
- **Neon Postgres + Drizzle** — policies, keys, decisions, cards, org settings
- **Stripe** — Billing (Free 500 decisions/mo, 1 policy → Pro $49/mo, unlimited) and Issuing (virtual cards / real-time authorization)
- **MCP** (`mcp-handler`) — native tools at `/api/mcp`
- **Vitest** — unit tests for the policy engine and request validation

## Project structure

```
src/
  app/
    api/
      [transport]/route.ts        # MCP server (streamable HTTP at /api/mcp)
      v1/evaluate/route.ts        # POST /api/v1/evaluate
      v1/decisions/route.ts       # GET /api/v1/decisions (+ ?status=pending)
      v1/decisions/[id]/route.ts  # GET /api/v1/decisions/:id
      v1/decisions/[id]/resolve/  # POST .../resolve (agent-side approve/deny)
      v1/simulate-charge/route.ts # POST /api/v1/simulate-charge
      webhooks/stripe/route.ts          # Stripe Billing webhook
      webhooks/stripe-issuing/route.ts  # Stripe Issuing authorization webhook
    dashboard/                    # overview, approvals, cards, policies, keys, billing
    sign-in/, sign-up/            # Clerk-hosted auth pages
    page.tsx, landing.css         # marketing/landing page
  components/                     # decision badge, integration tabs, landing effects
  db/
    schema.ts                     # Drizzle schema (policies, api_keys, decisions, agent_cards, org_settings)
    index.ts                      # Neon/Drizzle client
  lib/
    engine.ts                     # pure policy engine (matchPolicy, evaluate, validateRequest)
    engine.test.ts                # Vitest unit tests
    evaluate-service.ts           # wires the engine to the DB (plan limits, policy lookup, audit write)
    authorization.ts              # card-authorization gate used by the webhook + simulator
    cards.ts, keys.ts, store.ts, status.ts, stripe.ts, tenant.ts
  middleware.ts                   # Clerk middleware
```

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run db:push              # create tables in Neon
npm run dev
```

### 1. Neon (database)

1. [neon.tech](https://neon.tech) → sign up → **Create project** (name: velos)
2. Copy the **connection string** → `DATABASE_URL`
3. `npm run db:push` creates the tables

### 2. Clerk (auth)

1. [clerk.com](https://clerk.com) → sign up → **Create application** (name: Velos)
2. Enable **Email** + **Google** sign-in
3. Copy **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, **Secret key** → `CLERK_SECRET_KEY`
4. In Clerk dashboard → **Organizations** → enable organizations

### 3. Stripe (billing)

1. [stripe.com](https://stripe.com) → sign up (test mode is fine)
2. **Developers → API keys** → copy **Secret key** → `STRIPE_SECRET_KEY`
3. **Product catalog → Add product**: "Velos Pro", $49/month recurring → copy the **price id** → `STRIPE_PRO_PRICE_ID`
4. Webhook (local): `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → `STRIPE_WEBHOOK_SECRET`
5. Webhook (prod): **Developers → Webhooks → Add endpoint** `https://<your-domain>/api/webhooks/stripe`, events: `checkout.session.completed`, `customer.subscription.deleted`

## Usage / running locally

```bash
npm run dev          # start the Next.js dev server (http://localhost:3000)
npm run build         # production build
npm run start          # run the production build
npm run lint            # eslint
npm test                 # vitest run — engine + validation unit tests
npm run db:push            # push the Drizzle schema to the configured DATABASE_URL
npm run db:studio            # open Drizzle Studio against DATABASE_URL
```

Sign up through the dashboard, create a policy (monthly budget, auto-approve threshold, vendor allowlist), mint an API key, and point an agent at the REST API or the MCP server below.

## Agent API

```bash
# Evaluate a spend (API key from the dashboard → api keys)
curl -X POST https://<host>/api/v1/evaluate \
  -H "Authorization: Bearer vk_..." \
  -H "Content-Type: application/json" \
  -d '{"agent": "research-bot", "vendor": "OpenAI", "amount": 42.50, "reason": "embeddings"}'

# → { "id": "...", "decision": "approved", "policy": "Default", "explanation": "...", "created_at": "..." }

# Poll an escalated decision
curl https://<host>/api/v1/decisions/<id> -H "Authorization: Bearer vk_..."
# → { "id", "status": "pending" | "approved" | "denied", "decision", "resolution", ... }

# Audit log (newest first, max 100)
curl https://<host>/api/v1/decisions -H "Authorization: Bearer vk_..."

# Only escalations awaiting a human (for the agent to surface to its operator)
curl https://<host>/api/v1/decisions?status=pending -H "Authorization: Bearer vk_..."

# Approve/deny an escalation from the agent side instead of the dashboard
curl -X POST https://<host>/api/v1/decisions/<id>/resolve \
  -H "Authorization: Bearer vk_..." -H "Content-Type: application/json" \
  -d '{"verdict": "approved"}'
```

Decision order, first match wins:

1. Vendor not on the policy's allowlist → **denied**
2. Amount exceeds remaining monthly budget → **denied**
3. Amount under the auto-approve threshold → **approved**
4. Otherwise → **human_approval_required**

Budget counts auto-approved and human-approved spend; pending requests don't reserve budget. Policies match agents by explicit assignment first, then the org's default policy.

## Connect an agent or IDE (MCP)

Velos ships a native MCP server so any MCP-capable client gets four tools:

- `evaluate_spend(agent, vendor, amount, reason?)` — ask before spending
- `check_decision(id)` — poll an escalated decision
- `list_pending_approvals()` — list decisions awaiting a human
- `resolve_decision(id, verdict)` — approve/deny an escalation (only after a human operator has explicitly decided)

Endpoint (streamable HTTP): `https://<host>/api/mcp`
Auth: `Authorization: Bearer vk_...` (an API key from the dashboard).

### Claude Code

```bash
claude mcp add --transport http velos https://velos-chi.vercel.app/api/mcp \
  --header "Authorization: Bearer vk_..."
```

### Cursor / Windsurf

`.cursor/mcp.json` (or the Windsurf equivalent):

```json
{
  "mcpServers": {
    "velos": {
      "url": "https://velos-chi.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer vk_..." }
    }
  }
}
```

### Codex / Claude Desktop (stdio-only, via the mcp-remote bridge)

These clients speak stdio, so they connect through the `mcp-remote` bridge.

Codex — `~/.codex/config.toml`:

```toml
[mcp_servers.velos]
command = "npx"
args = ["-y", "mcp-remote", "https://velos-chi.vercel.app/api/mcp", "--header", "Authorization: Bearer vk_..."]
```

Claude Desktop — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "velos": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://velos-chi.vercel.app/api/mcp", "--header", "Authorization: Bearer vk_..."]
    }
  }
}
```

### No MCP? Just call the REST API

Any agent framework (LangChain, CrewAI, OpenAI Agents SDK) can skip MCP and
`POST /api/v1/evaluate` directly — see [Agent API](#agent-api) above.

## Enforcement rail (virtual cards)

Beyond the advisory API, Velos can **gate real money**. Each agent gets a
Stripe-issued virtual card; every charge hits Velos's real-time authorization
webhook and is approved/declined by the same policy engine, at the network,
within Stripe's ~2s window.

- Simulator (no Stripe needed): `POST /api/v1/simulate-charge` with
  `{ agent, merchant, amount }` and a `Bearer vk_...` key, or the "simulate a
  charge" panel on the dashboard Cards page.
- Real cards: `POST /api/webhooks/stripe-issuing` handles
  `issuing_authorization.request`. Needs `STRIPE_SECRET_KEY` +
  `STRIPE_ISSUING_WEBHOOK_SECRET`.

Intent matching: an approved `/evaluate` call is settled in-place by the
matching card charge, so budget is never double-counted.

**Stripe Issuing gotchas (learned the hard way):**

1. The webhook response **must** include a `Stripe-Version` header with a
   supported API version — without it Stripe declines with `webhook_error`.
2. Respond within ~2s. Keep `/api` routes out of Clerk middleware (extra edge
   hop) and defer the audit-log write with `after()`.
3. Fund the test Issuing balance in the dashboard or every charge dies at
   `insufficient_funds` before reaching the webhook.
4. New cards carry a default daily spending limit — raise it so the Velos
   policy engine is the sole gate (else charges decline via
   `authorization_controls`).

## Tests

```bash
npm test        # engine + validation unit tests (Vitest)
```

## Deploy (Vercel)

Push to the connected branch. Set all `.env.example` vars in Vercel → Project → Settings → Environment Variables. `NEXT_PUBLIC_APP_URL` = your production URL.
