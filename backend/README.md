# Relance Chantier — API Pro

Backend réel pour la version payante : comptes, factures, envoi automatique
des relances aux bonnes dates (J+7 amicale, J+15 ferme, J+30 mise en demeure),
parrainage, et abonnement Stripe.

En production : API sur Render (`relance-chantier-api.onrender.com`), interface
Pro statique servie depuis `pro/index.html`, base Postgres hébergée sur Supabase.

## Demarrer en local

```
cd backend
npm install
cp .env.example .env
```

Editez `.env` :
- `DATABASE_URL` : chaîne de connexion Postgres (Supabase).
- `JWT_SECRET` / `ADMIN_KEY` : mettez des chaines aleatoires.
- `RESEND_API_KEY` / `RESEND_FROM` : les emails de relance partent via l'API
  HTTPS de Resend (pas de SMTP direct — les hebergeurs gratuits comme Render
  bloquent le SMTP sortant). Compte sur https://resend.com.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` : pour
  l'abonnement Pro (15€/mois) et la récompense de parrainage.

```
npm start
```

L'API ecoute sur `http://localhost:4000` (ou `PORT` si defini dans `.env`).

## Routes principales

| Methode | Route | Description |
|---|---|---|
| POST | /api/auth/register | Creer un compte (email, password, artisanName, referralCode optionnel) |
| POST | /api/auth/login | Se connecter, recoit un token |
| GET | /api/me | Infos du compte connecte (plan, code/lien de parrainage) |
| DELETE | /api/me | Supprimer le compte (résilie l'abonnement Stripe s'il existe) |
| POST | /api/billing/create-checkout-session | Démarre le checkout Stripe pour passer Pro |
| POST | /api/billing/webhook | Webhook Stripe (activation/résiliation, récompense de parrainage) |
| GET | /api/invoices | Liste des factures du compte |
| POST | /api/invoices | Ajouter une facture/client |
| PATCH | /api/invoices/:id/paid | Marquer comme payee (arrete les relances) |
| DELETE | /api/invoices/:id | Supprimer une facture |
| GET | /api/invoices/:id/reminders | Historique des relances envoyees |
| POST | /api/admin/run-sweep | Declenche manuellement le passage des relances (header `x-admin-key`) |
| GET | /api/health | Ping |

Le passage automatique des relances tourne chaque jour via un workflow GitHub
Actions (`.github/workflows/reminder-sweep.yml`) qui appelle `/api/admin/run-sweep`
— le cron interne (`src/scheduler.js`) existe aussi mais ne se déclenche pas de
façon fiable sur l'instance Render gratuite (le process s'endort après 15 min
d'inactivité).
