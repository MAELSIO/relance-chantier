const cron = require('node-cron');
const db = require('./db');
const { sendReminderEmail } = require('./mailer');
const { buildSubject, buildEmailBody, daysLate, REMINDER_SCHEDULE } = require('./relanceTemplates');

const FREE_AUTO_SEND_LIMIT = 5;

function nextLevelDue(invoice) {
  const late = daysLate(invoice.due_date);
  let due = null;
  for (const step of REMINDER_SCHEDULE) {
    if (step.level > invoice.last_reminder_level && late >= step.atDaysLate) {
      due = step.level;
    }
  }
  return due;
}

async function runReminderSweep() {
  const users = db.prepare('SELECT * FROM users').all();
  const results = [];

  for (const user of users) {
    const invoices = db.prepare(
      "SELECT * FROM invoices WHERE user_id = ? AND status = 'unpaid'"
    ).all(user.id);

    for (const invoice of invoices) {
      const level = nextLevelDue(invoice);
      if (!level) continue;

      if (user.plan === 'free' && user.auto_sends_used >= FREE_AUTO_SEND_LIMIT) {
        results.push({ invoiceId: invoice.id, skipped: 'limite gratuite atteinte (5 essais)' });
        continue;
      }

      const subject = buildSubject(level, invoice.invoice_number);
      const body = buildEmailBody({
        level,
        artisanName: user.artisan_name,
        clientName: invoice.client_name,
        clientType: invoice.client_type,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.amount,
        dueDate: invoice.due_date
      });

      const sendResult = await sendReminderEmail({
        to: invoice.client_email,
        subject,
        body,
        fromName: user.artisan_name
      });

      db.prepare(
        'INSERT INTO reminder_log (invoice_id, level, email_status) VALUES (?, ?, ?)'
      ).run(invoice.id, level, sendResult.ok ? 'sent' : 'failed: ' + sendResult.reason);

      if (sendResult.ok) {
        db.prepare(
          "UPDATE invoices SET last_reminder_level = ?, last_reminder_sent_at = datetime('now') WHERE id = ?"
        ).run(level, invoice.id);
        db.prepare(
          'UPDATE users SET auto_sends_used = auto_sends_used + 1 WHERE id = ?'
        ).run(user.id);
      }

      results.push({ invoiceId: invoice.id, level, sent: sendResult.ok, reason: sendResult.reason });
    }
  }

  return results;
}

function startScheduler() {
  // Tous les jours a 8h.
  cron.schedule('0 8 * * *', () => {
    runReminderSweep().catch((err) => console.error('Erreur sweep relances:', err));
  });
}

module.exports = { startScheduler, runReminderSweep, FREE_AUTO_SEND_LIMIT };
