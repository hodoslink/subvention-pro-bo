# SubventionPro — Collecte association

Mini-appli web pour collecter, sans friction, les informations et documents
nécessaires au montage d'un dossier de subvention (ville/département).
Pensée pour un public peu à l'aise avec le numérique : une question à la fois,
auto-complétion SIRET, ton chaleureux.

## Ce que ça fait

- **Page d'accueil** : explique le parcours en 3 étapes, rassure avant de commencer.
- **Parcours en 6 écrans** (`/nouvelle-demande`) :
  1. Identité de l'association (auto-complétée via l'API publique SIRET)
  2. Contact + RIB
  3. Documents administratifs (upload, certains optionnels)
  4. Le projet, en langage simple (pas de jargon administratif)
  5. Budget prévisionnel, ligne par ligne
  6. Récapitulatif puis envoi
- **Stockage** : tout est enregistré dans une base Supabase (Postgres gratuit),
  exportable en Excel à tout moment.
- **API SIRET** : utilise `recherche-entreprises.api.gouv.fr`, gratuite et sans
  clé, pour retrouver automatiquement nom/adresse/SIREN d'une association.

## Mise en route (5-10 minutes)

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un compte et un nouveau projet (gratuit).
2. Dans **SQL Editor**, colle le contenu de `supabase_schema.sql` et exécute (Run).
3. Dans **Storage**, crée un bucket nommé `documents-asso` (privé).
4. Dans **Project Settings > API**, récupère :
   - `Project URL` → variable `SUPABASE_URL`
   - `service_role` key (⚠️ pas la clé `anon`) → variable `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configurer les variables d'environnement

Copie `.env.example` en `.env.local` et remplis avec tes vraies valeurs Supabase.

### 3. Lancer en local

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

### 4. Déployer sur Vercel

```bash
npm install -g vercel
vercel
```

Ou via l'interface Vercel : importe le repo GitHub, ajoute les deux variables
d'environnement (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) dans
**Settings > Environment Variables**, puis déploie.

## Pistes d'évolution (quand tu en auras besoin)

- **Upload réel des fichiers** : les composants `FileDrop` sont posés mais
  n'envoient pas encore vers Supabase Storage — c'est la prochaine brique à
  coder (upload signé + association à la ligne `documents_demande`).
- **Réutilisation du profil asso** : si une association a déjà rempli ses
  infos pour une 1ère demande, on peut chercher par SIRET dans `associations`
  et ne lui faire remplir que l'étape "projet" pour les demandes suivantes.
- **Tableau de bord presta/toi** : page `/dashboard` qui liste les demandes
  par statut (collecte → rédaction → contrôle compta → déposé → décision),
  avec accès filtré pour le presta rédacteur (lecture des demandes "à
  rédiger" uniquement).
- **Notifications automatiques** : email au presta quand une demande passe
  en statut "prête pour rédaction" (via Resend ou un simple webhook).
- **Export Excel** : route API qui interroge Supabase et génère un .xlsx
  à la demande (librairie `exceljs` côté serveur).

## Structure du projet

```
app/
  page.tsx                 → accueil
  nouvelle-demande/page.tsx → parcours en 6 étapes
  merci/page.tsx            → confirmation
  api/siret/route.ts        → proxy API publique SIRET
  api/associations/route.ts → création association
  api/demandes/route.ts     → création demande
components/
  PathProgress.tsx  → barre de progression "chemin"
  SiretSearch.tsx   → recherche + auto-complétion SIRET
  FileDrop.tsx      → upload de document
  StepUI.tsx        → briques communes (carte d'étape, champ, boutons nav)
supabase_schema.sql → schéma de base de données à exécuter dans Supabase
```
