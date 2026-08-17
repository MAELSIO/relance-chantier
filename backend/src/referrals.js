const crypto = require('crypto');
const db = require('./db');
const { getStripe } = require('./billing');

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Retourne le code de parrainage de l'utilisateur, en le générant si besoin
 * (comptes créés avant l'ajout de cette fonctionnalité n'en ont pas encore).
 */
async function getOrCreateReferralCode(userId) {
  const { rows } = await db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
  if (rows[0] && rows[0].referral_code) return rows[0].referral_code;

  // Boucle courte pour éviter une collision improbable sur la contrainte UNIQUE.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
      return code;
    } catch (err) {
      if (err.code !== '23505') throw err; // 23505 = unique_violation Postgres
    }
  }
  throw new Error('Impossible de générer un code de parrainage.');
}

/**
 * Nombre de filleuls inscrits via le code de cet utilisateur.
 * Traçabilité jusqu'à l'abonnement payant : croiser avec `plan = 'pro'`
 * (ex. `SELECT COUNT(*) FROM users WHERE referred_by_user_id = $1 AND plan = 'pro'`)
 * permet de savoir combien de filleuls sont devenus des clients payants,
 * pas seulement des comptes créés.
 */
async function getReferralCount(userId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM users WHERE referred_by_user_id = $1',
    [userId]
  );
  return rows[0].count;
}

/**
 * Associe un nouveau compte au parrain dont le code est fourni à
 * l'inscription. Non bloquant : un code invalide/inconnu est ignoré
 * silencieusement, ne doit jamais empêcher la création du compte.
 */
async function attributeReferral(newUserId, referralCode) {
  if (!referralCode) return;
  const { rows } = await db.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
  const referrer = rows[0];
  if (!referrer || referrer.id === newUserId) return;
  await db.query('UPDATE users SET referred_by_user_id = $1 WHERE id = $2', [referrer.id, newUserId]);
}

/**
 * Crédite 1 mois offert (Stripe customer balance, appliqué automatiquement
 * à la prochaine facture) au parrain ET au filleul, la première fois que
 * le filleul devient réellement payant (checkout Stripe complété).
 *
 * Le "claim" (UPDATE conditionnel atomique sur referral_reward_granted_at)
 * se fait AVANT tout appel Stripe : si le webhook est livré deux fois pour
 * le même événement, un seul appel gagne la course et personne n'est
 * crédité deux fois.
 */
async function grantReferralRewardIfDue(newUserId, amountCents, currency) {
  if (!amountCents || amountCents <= 0) return;

  const { rows: claimedRows } = await db.query(
    `UPDATE users SET referral_reward_granted_at = now()
     WHERE id = $1 AND referred_by_user_id IS NOT NULL AND referral_reward_granted_at IS NULL
     RETURNING referred_by_user_id`,
    [newUserId]
  );
  const claimed = claimedRows[0];
  if (!claimed) return; // pas de parrain, ou déjà récompensé

  const { rows: peopleRows } = await db.query(
    'SELECT id, email, stripe_customer_id FROM users WHERE id IN ($1, $2)',
    [newUserId, claimed.referred_by_user_id]
  );
  const referred = peopleRows.find((r) => r.id === newUserId);
  const referrer = peopleRows.find((r) => r.id === claimed.referred_by_user_id);
  if (!referred || !referrer || !referred.stripe_customer_id) return;

  const stripe = getStripe();
  if (!stripe) return;

  let referrerCustomerId = referrer.stripe_customer_id;
  if (!referrerCustomerId) {
    // Le parrain n'a jamais payé : pas encore de client Stripe.
    const customer = await stripe.customers.create({
      email: referrer.email,
      metadata: { userId: String(referrer.id), source: 'referral_reward' },
    });
    referrerCustomerId = customer.id;
    await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [referrerCustomerId, referrer.id]);
  }

  const description = 'Récompense parrainage Relance Chantier — 1 mois offert';
  await Promise.all([
    stripe.customers.createBalanceTransaction(referred.stripe_customer_id, {
      amount: -amountCents,
      currency,
      description: `${description} (vous avez utilisé un lien de parrainage)`,
    }),
    stripe.customers.createBalanceTransaction(referrerCustomerId, {
      amount: -amountCents,
      currency,
      description: `${description} (un de vos filleuls est passé Pro)`,
    }),
  ]);
}

module.exports = { getOrCreateReferralCode, getReferralCount, attributeReferral, grantReferralRewardIfDue };
