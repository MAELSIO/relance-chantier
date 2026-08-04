function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

/**
 * Envoie via l'API HTTPS de Resend plutot que par SMTP direct : les hebergeurs
 * gratuits (Render notamment) bloquent le SMTP sortant pour lutter contre le
 * spam, mais une simple requete HTTPS n'est jamais bloquee.
 */
async function sendReminderEmail({ to, subject, body, fromName }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY manquante : envoi non configuré.' };
  }

  const from = process.env.RESEND_FROM || 'Relance Chantier <onboarding@resend.dev>';

  try {
    const res = await withTimeout(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: body,
          reply_to: process.env.RESEND_REPLY_TO || undefined
        })
      }),
      15000,
      "Timeout : l'API Resend n'a pas repondu a temps."
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, reason: `Resend ${res.status}: ${data.message || res.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendReminderEmail };
