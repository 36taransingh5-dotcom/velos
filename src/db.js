import { DatabaseSync } from 'node:sqlite';

export function createDb(path = 'velos.db') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      vendor TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'denied', 'human_approval_required')),
      explanation TEXT NOT NULL,
      policy_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  return db;
}

export function insertDecision(db, { agent, vendor, amount, reason, decision, explanation, policyName }) {
  const stmt = db.prepare(`
    INSERT INTO decisions (agent, vendor, amount, reason, decision, explanation, policy_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(agent, vendor, amount, reason ?? null, decision, explanation, policyName);
  return db.prepare('SELECT * FROM decisions WHERE id = ?').get(result.lastInsertRowid);
}

// Sum of approved spend in the current UTC calendar month. Approved decisions
// count against the budget immediately — Velos assumes an approval is spent.
export function monthToDateSpend(db) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM decisions
    WHERE decision = 'approved'
      AND created_at >= strftime('%Y-%m-01T00:00:00Z', 'now')
  `).get();
  return row.total;
}

export function listDecisions(db, limit = 100) {
  return db.prepare('SELECT * FROM decisions ORDER BY id DESC LIMIT ?').all(limit);
}
