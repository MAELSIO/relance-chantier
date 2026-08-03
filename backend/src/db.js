const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    artisan_name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    auto_sends_used INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    invoice_number TEXT,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    client_type TEXT NOT NULL DEFAULT 'professionnel',
    status TEXT NOT NULL DEFAULT 'unpaid',
    last_reminder_level INTEGER NOT NULL DEFAULT 0,
    last_reminder_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminder_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    email_status TEXT NOT NULL
  );
`);

// Migrations legeres pour les bases deja existantes (CREATE TABLE IF NOT EXISTS
// ne modifie pas un schema deja cree, donc on ajoute les colonnes manquantes ici).
function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((c) => c.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('users', 'stripe_customer_id', 'TEXT');
ensureColumn('users', 'stripe_subscription_id', 'TEXT');

module.exports = db;
