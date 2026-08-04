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
    },
    // Sans ces timeouts, un hebergeur qui bloque/ralentit le port SMTP sortant
    // (frequent sur les plans gratuits) fait rester la requete bloquee indefiniment
    // au lieu d'echouer proprement.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
  return transporter;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

async function sendReminderEmail({ to, subject, body, fromName }) {
  const t = getTransporter();
  if (!t) {
    return { ok: false, reason: 'SMTP non configuré (SMTP_USER / SMTP_PASS manquants dans .env)' };
  }
  try {
    await withTimeout(
      t.sendMail({
        from: `"${fromName}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: body
      }),
      25000,
      "Timeout : le serveur SMTP n'a pas repondu a temps."
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendReminderEmail };
