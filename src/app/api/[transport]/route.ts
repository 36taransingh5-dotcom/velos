import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { evaluateForOrg } from '@/lib/evaluate-service';
import { orgForKey } from '@/lib/keys';
import { getDecision, pendingDecisions, resolveDecision } from '@/lib/store';
import { decisionStatus } from '@/lib/status';

export const runtime = 'nodejs';

/**
 * MCP server: gives any MCP-capable agent (Claude Code, Cursor, etc.)
 * native tools to ask Velos before spending. Auth: Authorization:
 * Bearer vk_... — the same API keys as the REST API.
 *
 * Mounted at [transport] so mcp-handler serves streamable HTTP at
 * /api/mcp and SSE at /api/sse (basePath below tells it the /api prefix).
 *
 * Client config (streamable HTTP):
 *   { "url": "https://<host>/api/mcp",
 *     "headers": { "Authorization": "Bearer vk_..." } }
 */
const handler = createMcpHandler((server) => {
  server.tool(
    'evaluate_spend',
    'Ask Velos whether a spend is allowed BEFORE spending money. Returns approved, denied, or human_approval_required with an explanation. If human approval is required, poll with check_decision using the returned id.',
    {
      agent: z.string().min(1).describe('Identifier of the agent requesting the spend, e.g. "research-bot"'),
      vendor: z.string().min(1).describe('Vendor being paid, e.g. "OpenAI"'),
      amount: z.number().positive().describe('Amount in USD'),
      reason: z.string().optional().describe('Why the agent wants to spend this'),
    },
    async ({ agent, vendor, amount, reason }, extra) => {
      const orgId = await orgFromAuth(extra.requestInfo?.headers);
      if (!orgId) return errorContent('Invalid or missing Velos API key.');

      const outcome = await evaluateForOrg(orgId, { agent, vendor, amount, reason });
      if (!outcome.ok) return errorContent(outcome.errors.join(' '));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(outcome.result, null, 2) }],
      };
    },
  );

  server.tool(
    'check_decision',
    'Check the status of a previous Velos spending decision by id. Returns approved, denied, or pending (still waiting on a human).',
    {
      id: z.string().uuid().describe('Decision id returned by evaluate_spend'),
    },
    async ({ id }, extra) => {
      const orgId = await orgFromAuth(extra.requestInfo?.headers);
      if (!orgId) return errorContent('Invalid or missing Velos API key.');

      const row = await getDecision(orgId, id);
      if (!row) return errorContent('Decision not found.');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: row.id,
                status: decisionStatus(row),
                explanation: row.explanation,
                resolved_at: row.resolvedAt,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'list_pending_approvals',
    'List spending decisions that are escalated and waiting on a human. Surface these to your operator so they can approve or deny in-app with resolve_decision.',
    {},
    async (_args, extra) => {
      const orgId = await orgFromAuth(extra.requestInfo?.headers);
      if (!orgId) return errorContent('Invalid or missing Velos API key.');

      const rows = await pendingDecisions(orgId);
      const pending = rows.map((r) => ({
        id: r.id,
        agent: r.agent,
        vendor: r.vendor,
        amount: Number(r.amount),
        reason: r.reason,
        explanation: r.explanation,
        created_at: r.createdAt,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(pending, null, 2) }],
      };
    },
  );

  server.tool(
    'resolve_decision',
    'Approve or deny an escalated spending decision. ONLY call this after a human operator has explicitly told you their decision — this is the human sign-off, not the agent deciding for itself. On approval, the agent can retry the spend and it will go through.',
    {
      id: z.string().uuid().describe('Decision id awaiting approval (from list_pending_approvals or evaluate_spend)'),
      verdict: z.enum(['approved', 'denied']).describe('The human operator\'s decision'),
    },
    async ({ id, verdict }, extra) => {
      const orgId = await orgFromAuth(extra.requestInfo?.headers);
      if (!orgId) return errorContent('Invalid or missing Velos API key.');

      const row = await resolveDecision(orgId, id, verdict, 'mcp');
      if (!row) return errorContent('Decision not found, or it is not awaiting human approval.');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { id: row.id, status: decisionStatus(row), resolution: row.resolution },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}, {}, { basePath: '/api' });

function errorContent(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

async function orgFromAuth(
  headers: Record<string, string | string[] | undefined> | undefined,
): Promise<string | null> {
  const raw = headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = (header ?? '').match(/^Bearer\s+(vk_[a-f0-9]{40})$/i);
  if (!match) return null;
  return orgForKey(match[1]);
}

export { handler as GET, handler as POST };
