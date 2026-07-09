import app, { policy } from './app.js';

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Velos listening on http://localhost:${port}`);
  console.log(`Policy: ${policy.name} — $${policy.monthly_budget}/month, auto-approve under $${policy.auto_approve_under}`);
});
