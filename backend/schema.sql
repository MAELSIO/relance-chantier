-- Schema Postgres (Supabase) pour Relance Chantier.
-- Remplace l'ancien schema SQLite (backend/src/db.js) : meme structure de
-- donnees, adaptee a la syntaxe Postgres (SERIAL, TIMESTAMPTZ, now()).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  artisan_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  auto_sends_used INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_log (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_status TEXT NOT NULL
);
