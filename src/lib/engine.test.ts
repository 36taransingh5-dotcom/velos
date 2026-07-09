import { describe, test, expect } from 'vitest';
import { evaluate, matchPolicy, validateRequest } from './engine';
import type { Policy } from '@/db/schema';

const basePolicy = {
  monthlyBudget: '2000',
  autoApproveUnder: '100',
  allowedVendors: ['OpenAI', 'Anthropic'],
};

function policy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: crypto.randomUUID(),
    orgId: 'org_1',
    name: 'Test Policy',
    monthlyBudget: '2000',
    autoApproveUnder: '100',
    allowedVendors: ['OpenAI'],
    agents: [],
    isDefault: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('evaluate', () => {
  test('denies vendor not on allowlist', () => {
    const r = evaluate(basePolicy, { vendor: 'RandomCo', amount: 10 }, 0);
    expect(r.decision).toBe('denied');
    expect(r.explanation).toMatch(/not on the allowed vendor list/);
  });

  test('denies when amount exceeds remaining budget', () => {
    const r = evaluate(basePolicy, { vendor: 'OpenAI', amount: 500 }, 1800);
    expect(r.decision).toBe('denied');
    expect(r.explanation).toMatch(/exceeds remaining monthly budget/);
  });

  test('auto-approves small amounts within budget', () => {
    const r = evaluate(basePolicy, { vendor: 'OpenAI', amount: 50 }, 0);
    expect(r.decision).toBe('approved');
  });

  test('escalates amounts at or above threshold', () => {
    expect(evaluate(basePolicy, { vendor: 'Anthropic', amount: 100 }, 0).decision).toBe(
      'human_approval_required',
    );
    expect(evaluate(basePolicy, { vendor: 'OpenAI', amount: 1500 }, 0).decision).toBe(
      'human_approval_required',
    );
  });

  test('vendor check runs before budget check', () => {
    const r = evaluate(basePolicy, { vendor: 'RandomCo', amount: 99999 }, 0);
    expect(r.decision).toBe('denied');
    expect(r.explanation).toMatch(/vendor/i);
  });

  test('denies small amount when budget exhausted', () => {
    expect(evaluate(basePolicy, { vendor: 'OpenAI', amount: 10 }, 2000).decision).toBe('denied');
  });

  test('approves exactly-remaining-budget amount under threshold', () => {
    expect(evaluate(basePolicy, { vendor: 'OpenAI', amount: 50 }, 1950).decision).toBe('approved');
  });

  test('empty vendor allowlist denies everything with readable message', () => {
    const r = evaluate({ ...basePolicy, allowedVendors: [] }, { vendor: 'OpenAI', amount: 10 }, 0);
    expect(r.decision).toBe('denied');
    expect(r.explanation).toMatch(/empty/);
  });
});

describe('matchPolicy', () => {
  test('agent-assigned policy wins over default', () => {
    const def = policy({ isDefault: true, name: 'Default' });
    const mine = policy({ agents: ['bot-1'], name: 'Bot policy' });
    expect(matchPolicy([def, mine], 'bot-1')?.name).toBe('Bot policy');
  });

  test('falls back to default when agent unassigned', () => {
    const def = policy({ isDefault: true, name: 'Default' });
    const other = policy({ agents: ['bot-2'] });
    expect(matchPolicy([def, other], 'bot-1')?.name).toBe('Default');
  });

  test('oldest assigned policy wins ties', () => {
    const a = policy({ agents: ['bot-1'], name: 'Newer', createdAt: new Date('2026-02-01') });
    const b = policy({ agents: ['bot-1'], name: 'Older', createdAt: new Date('2026-01-01') });
    expect(matchPolicy([a, b], 'bot-1')?.name).toBe('Older');
  });

  test('returns null with no default and no assignment', () => {
    expect(matchPolicy([policy({ agents: ['bot-2'] })], 'bot-1')).toBeNull();
  });
});

describe('validateRequest', () => {
  test('accepts a valid request and trims strings', () => {
    const r = validateRequest({ agent: ' bot-1 ', vendor: 'OpenAI', amount: 25, reason: 'credits' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.agent).toBe('bot-1');
  });

  test('reason is optional', () => {
    expect(validateRequest({ agent: 'a', vendor: 'v', amount: 1 }).ok).toBe(true);
  });

  test('rejects missing/empty agent and vendor', () => {
    expect(validateRequest({ vendor: 'v', amount: 1 }).ok).toBe(false);
    expect(validateRequest({ agent: '  ', vendor: 'v', amount: 1 }).ok).toBe(false);
    expect(validateRequest({ agent: 'a', amount: 1 }).ok).toBe(false);
  });

  test('rejects zero, negative, and non-numeric amounts', () => {
    for (const amount of [0, -5, '25', NaN, Infinity, null, undefined]) {
      expect(validateRequest({ agent: 'a', vendor: 'v', amount }).ok).toBe(false);
    }
  });

  test('rejects non-string reason', () => {
    expect(validateRequest({ agent: 'a', vendor: 'v', amount: 1, reason: 42 }).ok).toBe(false);
  });

  test('rejects non-object bodies', () => {
    for (const body of [null, 'x', 42, [1]]) {
      expect(validateRequest(body).ok).toBe(false);
    }
  });
});
