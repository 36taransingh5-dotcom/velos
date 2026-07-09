import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createDb, insertDecision, monthToDateSpend, listDecisions } from './db.js';
import { evaluate, validateRequest } from './policy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const policy = JSON.parse(readFileSync(path.join(__dirname, '../policy.json'), 'utf8'));

// Vercel's serverless filesystem is read-only outside /tmp. /tmp is
// per-invocation and not shared across instances, so the audit log does
// not persist reliably in that environment — see README's Deploying section.
const dbPath = process.env.VERCEL ? '/tmp/velos.db' : (process.env.VELOS_DB ?? 'velos.db');
const db = createDb(dbPath);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/evaluate', (req, res) => {
  const validation = validateRequest(req.body);
  if (!validation.ok) {
    return res.status(400).json({ errors: validation.errors });
  }

  const request = validation.value;
  const spent = monthToDateSpend(db);
  const { decision, explanation } = evaluate(policy, request, spent);

  const record = insertDecision(db, {
    ...request,
    decision,
    explanation,
    policyName: policy.name,
  });

  res.json({
    id: record.id,
    decision,
    policy: policy.name,
    explanation,
    created_at: record.created_at,
  });
});

app.get('/decisions', (req, res) => {
  res.json(listDecisions(db));
});

app.get('/policy', (req, res) => {
  const spent = monthToDateSpend(db);
  res.json({ ...policy, month_to_date_spend: spent, remaining_budget: policy.monthly_budget - spent });
});

// Malformed JSON bodies surface as a SyntaxError from express.json()
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ errors: ['Request body is not valid JSON.'] });
  }
  next(err);
});

export default app;
export { policy };
