const crypto = require('crypto');
const db = require('./db');

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

module.exports = { getOrCreateReferralCode, getReferralCount, attributeReferral };
