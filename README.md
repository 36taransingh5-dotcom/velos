# Velos

The financial control layer for AI agents. Velos sits between agents and money: every spending request passes through `POST /api/v1/evaluate`, gets an approved / denied / human-approval-required verdict with a plain-English explanation, and lands in an immutable audit log.

**Multi-tenant SaaS**: sign up, create policies, mint API keys, point your agents at the API (or the built-in MCP server).

## Stack

- **Next.js App Router** — dashboard + API in one deploy (Vercel)
- **Clerk** — auth with organizations
- **Neon Postgres + Drizzle** — policies, keys, decisions
- **Stripe** — Free (500 decisions/mo, 1 policy) → Pro ($49/mo, unlimited)
- **MCP** — native `evaluate_spend` / `check_decision` tools at `/api/mcp`

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
# → { "status": "pending" | "approved" | "denied", ... }

# Audit log
curl https://<host>/api/v1/decisions -H "Authorization: Bearer vk_..."
```

Decision order, first match wins:

1. Vendor not on the policy's allowlist → **denied**
2. Amount exceeds remaining monthly budget → **denied**
3. Amount under the auto-approve threshold → **approved**
4. Otherwise → **human_approval_required** (resolve in dashboard → approvals)

Budget counts auto-approved and human-approved spend; pending requests don't reserve budget. Policies match agents by explicit assignment first, then the org's default policy.

## Connect an agent or IDE (MCP)

Velos ships a native MCP server so any MCP-capable client gets two tools:

- `evaluate_spend(agent, vendor, amount, reason?)` — ask before spending
- `check_decision(id)` — poll an escalated decision

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

## Tests

```bash
npm test        # engine + validation unit tests
```

## Deploy (Vercel)

Push to the connected branch. Set all `.env.example` vars in Vercel → Project → Settings → Environment Variables. `NEXT_PUBLIC_APP_URL` = your production URL.
