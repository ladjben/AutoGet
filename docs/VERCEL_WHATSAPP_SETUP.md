# Installer WhatsApp Marketing avec Cursor et Vercel

Les changements sont sur la branche `feat/whatsapp-marketing` du dépôt `ladjben/AutoGet`.
La branche principale et la base ERP ne sont pas modifiées par cette préparation.

## 1. Récupérer le code dans Cursor

Ouvrir le projet AutoGet dans Cursor. Dans son terminal :

```bash
git fetch origin
git switch feat/whatsapp-marketing
npm ci
npm run build
```

Si Cursor signale des modifications locales, les conserver avant de changer de branche. Ne pas les écraser.

Le déploiement Preview de la branche permet de contrôler le build. Les envois WhatsApp y sont toujours bloqués, même si une variable de production y a été copiée. Sans variables marketing, l’application historique continue de se compiler ; seule la page marketing indique qu’il reste à la configurer.

## 2. Préparer Neon une fois

Dans l’éditeur SQL du projet Neon qui contient les commandes ERP :

1. Exécuter le contenu de `sql/whatsapp-erp-delivered-items.sql`. Il crée une **vue** de lecture ; il ne change aucune commande.
2. Exécuter `sql/verify-whatsapp-erp-adapter.sql` pour contrôler la couverture des commandes et pointures.

Dans une base Neon dédiée au marketing :

3. Exécuter `sql/whatsapp-marketing.sql`. Ce script crée les tables de campagnes, consentements et suivi.

Il est aussi possible d’utiliser la même base Neon avec le schéma privé `marketing`, mais avec des rôles distincts : le rôle du service marketing peut écrire dans `marketing`, celui de l’ERP peut seulement lire `autoget_marketing.delivered_items`. L’administrateur Neon doit attribuer `USAGE` sur le schéma et `SELECT` sur la vue au rôle de lecture. Aucun rôle ni mot de passe n’est créé automatiquement par ces scripts.

Récupérer les deux chaînes de connexion dans Neon :

- `NEON_ERP_DATABASE_URL` : connexion en lecture seule à la vue ERP.
- `MARKETING_DATABASE_URL` : connexion à la base marketing, **directe**, sans `-pooler` dans l’hôte.

Utiliser TLS avec `sslmode=verify-full`. Ne pas coller ces chaînes dans une conversation ou dans GitHub.

Si la migration marketing de la version précédente a déjà été appliquée, exécuter `sql/whatsapp-serverless.sql` et, si absent, `sql/whatsapp-marketing-consents.sql` dans la base marketing. Une installation neuve nécessite uniquement la migration complète.

## 3. Générer les accès dans Cursor

```bash
npm run marketing:secrets
```

Ouvrir le fichier créé `.env.marketing.local`. Il est privé et ignoré par Git. Le générateur refuse d’écraser un fichier existant.

- Garder `ADMIN_PASSWORD_LOCAL_ONLY` dans un gestionnaire de mots de passe : c’est le mot de passe de l’écran marketing. **Ne pas le copier dans Vercel.**
- Les quatre autres valeurs seront utilisées ci-dessous.

## 4. Renseigner les variables dans Vercel

Projet AutoGet → **Settings → Environment Variables**. Pour commencer, choisir l’environnement **Production**. Utiliser l’adresse stable du site, pas l’URL temporaire d’un déploiement Preview.

| Nom | Valeur à renseigner |
| --- | --- |
| `MARKETING_DATABASE_URL` | Connexion directe à la base marketing |
| `NEON_ERP_DATABASE_URL` | Connexion de lecture de l’ERP |
| `NEON_ERP_VIEW` | `autoget_marketing.delivered_items` |
| `MARKETING_ORIGIN` | Adresse exacte du site, ex. `https://mon-autoget.vercel.app`, sans chemin |
| `MARKETING_ADMIN_PASSWORD_HASH` | Valeur du fichier privé créé dans Cursor |
| `MARKETING_SESSION_SECRET` | Valeur du même fichier |
| `CRON_SECRET` | Valeur du même fichier |
| `WHATSAPP_VERIFY_TOKEN` | Valeur du même fichier |
| `WHATSAPP_ACCESS_TOKEN` | Jeton système de l’application Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro WhatsApp Business |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Identifiant du compte WhatsApp Business (WABA) |
| `WHATSAPP_APP_SECRET` | Secret de l’application Meta |
| `WHATSAPP_GRAPH_VERSION` | `v25.0`, ou version prise en charge par votre application Meta |
| `WHATSAPP_DEFAULT_COUNTRY` | `DZ` pour les numéros locaux algériens |
| `WHATSAPP_MESSAGES_PER_SECOND` | `1` pour commencer |
| `WHATSAPP_SENDING_ENABLED` | **`false` pour commencer** |
| `NODE_ENV` | `production` |

Conserver les variables Supabase existantes. Ne préfixer aucun secret par `VITE_` : ce préfixe rendrait la valeur accessible au navigateur.

Dans les réglages du projet Vercel, activer **Fluid Compute** et utiliser Node.js **22.x**. Le fichier `vercel.json` prévoit une fonction de 300 secondes. Le frontal reste en Vite, avec la sortie `dist` ; ne pas changer le framework en Express.

## 5. Déployer sur le site

Relire les changements, puis fusionner la branche `feat/whatsapp-marketing` dans `main` via GitHub ou Cursor, selon le fonctionnement habituel du projet. Cela déclenchera le déploiement Production Vercel. Cette fusion n’a pas été faite automatiquement.

Après un changement de variables Vercel, effectuer un nouveau déploiement pour les prendre en compte.

Ouvrir AutoGet → **WhatsApp Marketing** et entrer le mot de passe conservé à l’étape 3. Les clients doivent s’afficher. Les envois sont encore désactivés.

## 6. Activer le passage automatique dans GitHub

GitHub sert de réveil : environ toutes les cinq minutes, il appelle Vercel pour traiter un lot. La liste des messages reste dans Neon entre les passages. Cela fonctionne navigateur et Cursor fermés, sans serveur permanent à héberger.

Dans le dépôt GitHub → **Settings → Secrets and variables → Actions** :

- Onglet **Secrets** : créer `CRON_SECRET` avec **la même valeur** que dans Vercel.
- Onglet **Variables** : créer `MARKETING_ORIGIN` avec la même adresse Production que dans Vercel.
- Onglet **Variables** : créer `MARKETING_WORKER_ENABLED` avec la valeur `true`.

Puis onglet **Actions → WhatsApp campaign worker → Run workflow**, sur `main`. Le premier passage doit devenir vert. Sans campagne active et avec les envois désactivés, aucun message ne part ; ce passage vérifie la configuration de l’appel et enregistre son état. L’écran marketing affiche son dernier passage après actualisation.

Le fichier de workflow doit être présent sur la branche par défaut pour que la programmation GitHub fonctionne. Les exécutions planifiées ne sont pas instantanées : elles peuvent être retardées ou abandonnées en cas de charge, et GitHub désactive les schedules des dépôts publics sans activité pendant 60 jours. Surveiller l’onglet Actions et le dernier passage affiché dans AutoGet. Les minutes Actions et les ressources Vercel restent soumises aux limites du compte. Le workflow peut aussi être relancé manuellement.

Si l’adresse Production est protégée par une authentification Vercel, autoriser l’appel machine de manière adaptée ou utiliser le domaine public de l’application ; la route est déjà protégée par `CRON_SECRET`. Ne pas supprimer la protection de toute l’application pour résoudre un simple mauvais domaine.

## 7. Configurer Meta et le premier essai

Dans l’application Meta / configuration WhatsApp :

- URL du webhook : `https://VOTRE-SITE/api/whatsapp/webhook`.
- Token de vérification : `WHATSAPP_VERIFY_TOKEN`.
- Souscrire au champ `messages` et abonner l’application au WABA.
- Disposer d’un modèle approuvé. L’écran Modèles peut soumettre des modèles texte à Meta, qui décide de leur approbation.

L’ERP fourni n’expose pas le consentement WhatsApp actuel. Les contacts sont visibles, mais l’envoi exige un consentement vérifié dans `marketing.consents` (voir `docs/WHATSAPP_MARKETING.md`). Ne pas considérer automatiquement tous les clients livrés comme consentants.

Pour un essai réel : enregistrer le consentement d’un numéro de test, sélectionner ce seul contact, choisir un modèle approuvé et préparer le brouillon. Passer `WHATSAPP_SENDING_ENABLED` à `true` dans Vercel, redéployer, vérifier un passage GitHub récent, puis cliquer **Lancer l’envoi** sur ce brouillon. Le prochain passage automatique traitera le message.

Une réponse acceptée par Meta apparaît comme « Accepté par Meta » ; le webhook confirme ensuite « Livré » ou « Lu ».

## En cas de problème

| Affichage | Vérification |
| --- | --- |
| Marketing non configuré | Variables serveur manquantes, puis redéploiement |
| Service indisponible | Connexions Neon, migration marketing, droits SELECT sur la vue ERP |
| Aucun contact éligible | Consentements actuels absents ou désinscriptions |
| Worker en attente | Variables/secrets GitHub, workflow sur `main`, dernier passage |
| Workflow rouge | Ouvrir son journal : domaine Production, CRON_SECRET, accès Vercel, base marketing |
| À vérifier | Réponse d’envoi incertaine : contrôler Meta avant tout renvoi |

Les tests locaux vérifient le build, PostgreSQL, l’authentification, les campagnes et le routage de la fonction. Ils ne remplacent pas le premier essai configuré sur votre compte Neon/Meta/Vercel.

Références : [durées des fonctions Vercel](https://vercel.com/docs/functions/configuring-functions/duration), [limitations des Cron Jobs Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), [programmation des workflows GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
