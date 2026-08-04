const nodemailer = require('nodemailer');
const dns = require('dns').promises;

let cachedTransporterKey = null;
let transporter = null;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

/**
 * Certaines plateformes annoncent une route IPv6 qui n'est en realite pas
 * routee, ce qui fait echouer la connexion SMTP avec ENETUNREACH une fois
 * sur deux (nodemailer choisit une adresse au hasard parmi IPv4 et IPv6).
 * On resout nous-memes une adresse IPv4 et on la passe en `host`, avec le
 * nom d'origine en `servername` pour que le SNI/certificat TLS restent corrects.
 */
async function resolveIPv4Host(hostname) {
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    return address;
  } catch (err) {
    return hostname;
  }
}

async function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const key = `${smtpHost}:${process.env.SMTP_USER}`;
  if (transporter && cachedTransporterKey === key) return transporter;

  const ipv4Address = await resolveIPv4Host(smtpHost);

  transporter = nodemailer.createTransport({
    host: ipv4Address,
    servername: smtpHost,
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
  cachedTransporterKey = key;
  return transporter;
}

async function sendReminderEmail({ to, subject, body, fromName }) {
  const t = await getTransporter();
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
