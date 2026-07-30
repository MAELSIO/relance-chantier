require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { hashPassword, verifyPassword, signToken, requireAuth } = require('./auth');
const { startScheduler, runReminderSweep, FREE_AUTO_SEND_LIMIT } = require('./scheduler');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Auth ----------

app.post('/api/auth/register', (req, res) => {
  const { email, password, artisanName } = req.body || {};
  if (!email || !password || !artisanName) {
    return res.status(400).json({ error: 'email, password et artisanName sont requis.' });
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

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
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
  const info = db.prepare(
    `INSERT INTO invoices (user_id, client_name, client_email, invoice_number, amount, due_date, client_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, clientName, clientEmail, invoiceNumber || null, amount, dueDate, clientType || 'professionnel');
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
