import { listCards, issueCard } from '@/lib/store';
import type { AgentCard } from '@/db/schema';

/**
 * The active Velos card for an agent, issuing one on first use so a
 * simulated (or real) charge always has a card to route through.
 */
export async function getOrIssueCardForAgent(orgId: string, agent: string): Promise<AgentCard> {
  const cards = await listCards(orgId);
  const existing = cards.find((c) => c.agent === agent && c.status === 'active');
  if (existing) return existing;
  const frozen = cards.find((c) => c.agent === agent);
  if (frozen) return frozen; // surface the frozen card so the charge is declined
  return issueCard(orgId, agent);
}
