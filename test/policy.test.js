import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validateRequest } from '../src/policy.js';
import { createDb, insertDecision, monthToDateSpend } from '../src/db.js';

const policy = {
  name: 'Test Policy',
  monthly_budget: 2000,
  auto_approve_under: 100,
  allowed_vendors: ['OpenAI', 'Anthropic'],
};

describe('evaluate', () => {
  test('denies vendor not on allowlist', () => {
    const result = evaluate(policy, { vendor: 'RandomCo', amount: 10 }, 0);
    assert.equal(result.decision, 'denied');
    assert.match(result.explanation, /not on the allowed vendor list/);
  });

  test('denies when amount exceeds remaining budget', () => {
    const result = evaluate(policy, { vendor: 'OpenAI', amount: 500 }, 1800);
    assert.equal(result.decision, 'denied');
    assert.match(result.explanation, /exceeds remaining monthly budget/);
  });

  test('auto-approves small amounts within budget', () => {
    const result = evaluate(policy, { vendor: 'OpenAI', amount: 50 }, 0);
    assert.equal(result.decision, 'approved');
  });

  test('escalates amounts at or above threshold', () => {
    const result = evaluate(policy, { vendor: 'Anthropic', amount: 100 }, 0);
    assert.equal(result.decision, 'human_approval_required');
  });

  test('escalates amounts above threshold but within budget', () => {
    const result = evaluate(policy, { vendor: 'OpenAI', amount: 1500 }, 0);
    assert.equal(result.decision, 'human_approval_required');
  });

  test('vendor check runs before budget check', () => {
    const result = evaluate(policy, { vendor: 'RandomCo', amount: 99999 }, 0);
    assert.equal(result.decision, 'denied');
    assert.match(result.explanation, /vendor/i);
  });

  test('denies small amount when budget is exhausted', () => {
    const result = evaluate(policy, { vendor: 'OpenAI', amount: 10 }, 2000);
    assert.equal(result.decision, 'denied');
  });

  test('approves exactly-remaining-budget amount under threshold', () => {
    const result = evaluate(policy, { vendor: 'OpenAI', amount: 50 }, 1950);
    assert.equal(result.decision, 'approved');
  });
});

describe('validateRequest', () => {
  test('accepts a valid request and trims strings', () => {
    const result = validateRequest({ agent: ' bot-1 ', vendor: 'OpenAI', amount: 25, reason: 'API credits' });
    assert.equal(result.ok, true);
    assert.equal(result.value.agent, 'bot-1');
  });

  test('reason is optional', () => {
    const result = validateRequest({ agent: 'bot-1', vendor: 'OpenAI', amount: 25 });
    assert.equal(result.ok, true);
  });

  test('rejects missing agent', () => {
    const result = validateRequest({ vendor: 'OpenAI', amount: 25 });
    assert.equal(result.ok, false);
    assert.match(result.errors[0], /agent/);
  });

  test('rejects empty vendor', () => {
    const result = validateRequest({ agent: 'bot-1', vendor: '  ', amount: 25 });
    assert.equal(result.ok, false);
  });

  test('rejects zero, negative, and non-numeric amounts', () => {
    for (const amount of [0, -5, '25', NaN, Infinity, null, undefined]) {
      const result = validateRequest({ agent: 'bot-1', vendor: 'OpenAI', amount });
      assert.equal(result.ok, false, `amount=${amount} should be rejected`);
    }
  });

  test('rejects non-string reason', () => {
    const result = validateRequest({ agent: 'bot-1', vendor: 'OpenAI', amount: 25, reason: 42 });
    assert.equal(result.ok, false);
  });

  test('rejects non-object bodies', () => {
    for (const body of [null, 'string', 42]) {
      const result = validateRequest(body);
      assert.equal(result.ok, false, `body=${body} should be rejected`);
    }
  });
});

describe('db', () => {
  test('month-to-date spend counts only approved decisions', () => {
    const db = createDb(':memory:');
    const base = { agent: 'bot-1', vendor: 'OpenAI', reason: null, policyName: 'Test' };
    insertDecision(db, { ...base, amount: 50, decision: 'approved', explanation: 'x' });
    insertDecision(db, { ...base, amount: 500, decision: 'denied', explanation: 'x' });
    insertDecision(db, { ...base, amount: 200, decision: 'human_approval_required', explanation: 'x' });
    insertDecision(db, { ...base, amount: 30, decision: 'approved', explanation: 'x' });
    assert.equal(monthToDateSpend(db), 80);
  });

  test('insertDecision returns the stored record', () => {
    const db = createDb(':memory:');
    const record = insertDecision(db, {
      agent: 'bot-1', vendor: 'OpenAI', amount: 50, reason: 'credits',
      decision: 'approved', explanation: 'ok', policyName: 'Test',
    });
    assert.equal(record.agent, 'bot-1');
    assert.equal(record.decision, 'approved');
    assert.ok(record.created_at);
  });
});
