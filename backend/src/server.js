require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { hashPassword, verifyPassword, signToken, requireAuth } = require('./auth');
const { startScheduler, runReminderSweep, FREE_AUTO_SEND_LIMIT } = require('./scheduler');
const { createCheckoutSession, verifyWebhook } = require('./billing');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://www.relancechantier.fr,https://relancechantier.fr,https://maelsio.github.io'
).split(',').map((s) => s.trim());

const app = express();
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Autorise les appels sans origine (curl, apps mobiles) et les origines connues,
    // plus toujours localhost/file:// pour le développement local.
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost') || origin === 'null') {
      return callback(null, true);
    }
    callback(new Error('Origine non autorisée : ' + origin));
  }
}));

// Webhook Stripe : doit lire le corps brut (avant express.json()) pour verifier la signature.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = verifyWebhook(req.body, req.headers['stripe-signature']);
  } catch (err) {
    return res.status(400).send('Webhook signature invalide: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata && session.metadata.userId;
    if (userId) {
      db.prepare(
        "UPDATE users SET plan = 'pro', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
      ).run(session.customer, session.subscription, userId);
    }
  } else if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    db.prepare(
      "UPDATE users SET plan = ? WHERE stripe_subscription_id = ?"
    ).run(isActive ? 'pro' : 'free', sub.id);
  }

  res.json({ received: true });
});

app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' }
});

// ---------- Auth ----------

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { email, password, artisanName } = req.body || {};
  if (!email || !password || !artisanName) {
    return res.status(400).json({ error: 'email, password et artisanName sont requis.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  const passwordHash = hashPassword(password);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, artisan_name) VALUES (?, ?, ?)'
  ).run(email, passwordHash, artisanName);
  const user = { id: info.lastInsertRowid, email };
  res.status(201).json({ token: signToken(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }
  res.json({ token: signToken(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, artisan_name, plan, auto_sends_used FROM users WHERE id = ?'
  ).get(req.userId);
  res.json({ ...user, freeAutoSendLimit: FREE_AUTO_SEND_LIMIT });
});

// ---------- Facturation (Stripe) ----------

app.post('/api/billing/create-checkout-session', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: "L'abonnement n'est pas encore disponible." });
  }
  try {
    const origin = req.headers.origin || 'https://www.relancechantier.fr';
    const session = await createCheckoutSession({
      user,
      priceId: process.env.STRIPE_PRICE_ID,
      successUrl: origin + '/pro/?abonnement=succes',
      cancelUrl: origin + '/pro/?abonnement=annule'
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Invoices / clients ----------

app.get('/api/invoices', requireAuth, (req, res) => {
  const invoices = db.prepare(
    'SELECT * FROM invoices WHERE user_id = ? ORDER BY due_date ASC'
  ).all(req.userId);
  res.json(invoices);
});

app.post('/api/invoices', requireAuth, (req, res) => {
  const { clientName, clientEmail, invoiceNumber, amount, dueDate, clientType } = req.body || {};
  if (!clientName || !clientEmail || !amount || !dueDate) {
    return res.status(400).json({ error: 'clientName, clientEmail, amount et dueDate sont requis.' });
  }
  if (!EMAIL_RE.test(clientEmail)) {
    return res.status(400).json({ error: "Email du client invalide." });
  }
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Le montant doit être un nombre positif.' });
  }
  if (isNaN(new Date(dueDate).getTime())) {
    return res.status(400).json({ error: "Date d'échéance invalide." });
  }
  if (clientType && !['professionnel', 'particulier'].includes(clientType)) {
    return res.status(400).json({ error: 'clientType doit être professionnel ou particulier.' });
  }
  const info = db.prepare(
    `INSERT INTO invoices (user_id, client_name, client_email, invoice_number, amount, due_date, client_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, clientName, clientEmail, invoiceNumber || null, numAmount, dueDate, clientType || 'professionnel');
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(invoice);
});

app.patch('/api/invoices/:id/paid', requireAuth, (req, res) => {
  const invoice = db.prepare(
    'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });
  db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(invoice.id);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', requireAuth, (req, res) => {
  const invoice = db.prepare(
    'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);
  res.json({ ok: true });
});

app.get('/api/invoices/:id/reminders', requireAuth, (req, res) => {
  const invoice = db.prepare(
    'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });
  const log = db.prepare(
    'SELECT * FROM reminder_log WHERE invoice_id = ? ORDER BY sent_at DESC'
  ).all(invoice.id);
  res.json(log);
});

// ---------- Manual trigger (testing / admin) ----------

app.post('/api/admin/run-sweep', async (req, res) => {
  if (req.headers['x-admin-key'] !== (process.env.ADMIN_KEY || 'dev-admin-key')) {
    return res.status(403).json({ error: 'Clé admin invalide.' });
  }
  const results = await runReminderSweep();
  res.json({ results });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Relance Chantier API en écoute sur http://localhost:${PORT}`);
  startScheduler();
});
