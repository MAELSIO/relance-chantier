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

-- Migration : programme de parrainage (idempotente, sûre à rejouer).
-- referral_code : code partageable propre à chaque utilisateur (généré à
--   la demande, voir src/referrals.js — pas de valeur par défaut ici pour
--   ne pas devoir backfiller tous les comptes existants d'un coup).
-- referred_by_user_id : parrain de ce compte, s'il s'est inscrit via un
--   lien de parrainage. Permet de tracer jusqu'à l'abonnement payant en
--   croisant avec la colonne `plan` (voir src/referrals.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER REFERENCES users(id);

-- Récompense de parrainage : 1 mois offert au parrain ET au filleul,
-- crédité (Stripe customer balance) quand le filleul devient réellement
-- payant. NULL tant que non accordée — voir src/referrals.js.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_granted_at TIMESTAMPTZ;
