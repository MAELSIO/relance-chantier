const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL manquante : renseignez la chaine de connexion Postgres (Supabase) dans .env.'
  );
}

// Supabase exige une connexion TLS ; le certificat n'a pas besoin d'etre
// verifie ici (pas de donnees sensibles au niveau reseau local/hebergeur).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Les tables vivent maintenant dans une vraie base Postgres (Supabase), plus
// dans un fichier SQLite sur le disque de l'hebergeur. Sur le plan gratuit de
// Render, ce disque est efface a chaque redemarrage du service (mise en veille
// apres ~15 min d'inactivite) : c'etait la cause de la disparition des donnees.
// Voir schema.sql pour la structure des tables.
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query, pool };
