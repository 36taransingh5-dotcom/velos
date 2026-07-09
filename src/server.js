import express from 'express';
import { readFileSync } from 'node:fs';
import { createDb, insertDecision, monthToDateSpend, listDecisions } from './db.js';
import { evaluate, validateRequest } from './policy.js';

const policy = JSON.parse(readFileSync(new URL('../policy.json', import.meta.url), 'utf8'));
const db = createDb(process.env.VELOS_DB ?? 'velos.db');

const app = express();
app.use(express.json());
app.use(express.static(new URL('../site', import.meta.url).pathname));

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

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Velos listening on http://localhost:${port}`);
  console.log(`Policy: ${policy.name} — $${policy.monthly_budget}/month, auto-approve under $${policy.auto_approve_under}`);
});
