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

module.exports = db;
