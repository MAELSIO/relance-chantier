# Relance Chantier — API Pro

Backend reel pour la version payante : comptes, factures, et envoi automatique
des relances aux bonnes dates (J+7 amicale, J+15 ferme, J+30 mise en demeure).

Teste de bout en bout : inscription, connexion, ajout de facture, detection
automatique du niveau de relance du, tentative d'envoi, journalisation,
passage en paye, rejets d'authentification. Tout fonctionne.

## Demarrer en local

```
cd backend
npm install
cp .env.example .env
```

Editez `.env` :
- `JWT_SECRET` / `ADMIN_KEY` : mettez des chaines aleatoires.
- `SMTP_USER` / `SMTP_PASS` : un compte Gmail + un **mot de passe d'application**
  (pas votre mot de passe Gmail habituel). A generer sur
  https://myaccount.google.com/apppasswords (necessite la validation en 2 etapes
  activee sur le compte).

```
npm start
```

L'API ecoute sur `http://localhost:4000`.

## Routes principales

| Methode | Route | Description |
|---|---|---|
| POST | /api/auth/register | Creer un compte (email, password, artisanName) |
| POST | /api/auth/login | Se connecter, recoit un token |
| GET | /api/me | Infos du compte connecte |
| GET | /api/invoices | Liste des factures du compte |
| POST | /api/invoices | Ajouter une facture/client |
| PATCH | /api/invoices/:id/paid | Marquer comme payee (arrete les relances) |
| DELETE | /api/invoices/:id | Supprimer une facture |
| GET | /api/invoices/:id/reminders | Historique des relances envoyees |
| POST | /api/admin/run-sweep | Declenche manuellement le passage des relances (header `x-admin-key`) |

En production, le passage automatique tourne tout seul chaque jour a 8h
(voir `src/scheduler.js`).

## Ce qui reste a faire pour que ce soit en ligne

1. **Hebergement** : ce backend doit tourner sur un serveur Node (GitHub Pages
   ne fait que du statique). Options gratuites simples : Render.com, Railway.app,
   Fly.io. Necessite un compte cree par vous (pas par Claude).
2. **Variables d'environnement** : configurer JWT_SECRET, ADMIN_KEY, SMTP_USER,
   SMTP_PASS sur l'hebergeur choisi.
3. **Interface Pro** : ce depot ne contient que l'API. Il manque encore l'ecran
   de connexion/inscription et le tableau de bord (ajouter un client, voir ses
   factures, marquer paye) cote site — l'equivalent du "bordereau" mais pour
   la version Pro connectee a cette API.
4. **Stripe** : toujours pas branche, a faire une fois le reste en place.
