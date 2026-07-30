const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

async function sendReminderEmail({ to, subject, body, fromName }) {
  const t = getTransporter();
  if (!t) {
    return { ok: false, reason: 'SMTP non configuré (SMTP_USER / SMTP_PASS manquants dans .env)' };
  }
  try {
    await t.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: body
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendReminderEmail };
