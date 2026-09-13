# Installer WhatsApp dans AutoGet, étape par étape

**Version Supabase avec copie des clients — remplace les anciennes instructions Neon.**
Ne pas exécuter les anciens scripts de vue sur le projet ERP principal.
Aucune migration ni connexion de production n’a été effectuée pendant le développement.

## 1. Valider sur une copie avant toute installation

Les commandes restent dans Neon. Les données marketing iront dans la base Supabase déjà utilisée par AutoGet, dans le nouveau schéma privé `marketing`.

Créer une branche de test Neon avec calculateur séparé et préparer une base PostgreSQL/Supabase de test. Ne pas redimensionner le calculateur ERP principal pour cette opération. La branche est une copie à un instant donné, pas une synchronisation permanente.

Le premier import est un test contrôlé, pas une preuve de capacité de production. Mesurer sa durée, le volume copié et l’activité du calculateur. Si une limite est atteinte, conserver l’import désactivé : revoir les plans de lecture et envisager une réplique de lecture, plutôt qu’augmenter les délais sur l’ERP principal.

## 2. Installer les tables marketing, sur Supabase

Après validation sur la base de test : utiliser `sql/whatsapp-supabase-install.sql` dans l’éditeur SQL de **Supabase AutoGet**.

Ce fichier est réservé à une installation neuve. Il refuse de continuer si le schéma `marketing` ou le rôle `autoget_marketing_app` existe déjà. Il crée les tables privées et leurs règles d’accès dans une seule transaction ; un échec annule l’ensemble. Il ne modifie pas `public`, `auth`, `storage` ni les relations de l’application existante.

Ne pas exposer `marketing` dans les réglages Data API et ne pas y donner accès à `anon` ou `authenticated`. RLS est activée. Le groupe `autoget_marketing_app` peut uniquement utiliser les tables marketing. Créer un identifiant serveur dédié, sans droits administrateur ni autres appartenances, puis lui attribuer ce groupe. Son mot de passe doit être défini dans un outil privé, jamais dans GitHub ou une conversation. Vérifier que cet identifiant ne peut pas modifier les tables historiques d’AutoGet.

Récupérer une connexion PostgreSQL **Session pooler, port 5432**, avec cet identifiant (le nom de connexion Supabase contient aussi la référence du projet). Une connexion directe convient aussi si le réseau le permet. Ne pas choisir Transaction/6543 : les verrous de coordination ont besoin d’une session stable.

Les installations anciennes nécessitent une revue : `sql/whatsapp-supabase-sync.sql` ajoute la copie et active RLS, mais les politiques et les droits du compte serveur doivent être adaptés avant son exécution. Ne pas l’utiliser aveuglément avec un ancien rôle non propriétaire.

## 3. Donner un accès de lecture limité à l’import

Sur la copie Neon d’abord, préparer un identifiant dédié sans droits d’écriture, sans rôle administrateur, limité aux colonnes de ces six tables :

- `woo_orders`
- `delivered_order_items`
- `confrimed_order_items` (orthographe réelle)
- `product_variants`
- `products`
- `woo_order_items`

Le fichier `sql/whatsapp-erp-reader.sql` prépare les droits du groupe de lecture. Il ne crée aucune vue ni relation et n’écrit dans aucune table ERP. L’attribution de ce groupe au compte de connexion reste à faire après contrôle de ses autres droits. Les droits hérités/PUBLIC peuvent donner des accès supplémentaires : un groupe de lecture n’annule pas ces droits existants.

Le programme d’import utilise uniquement `server/marketing/erp-source.sql`, une requête SELECT. Chaque import démarre une transaction explicitement en lecture seule. Il dispose d’une connexion source, d’un délai par requête de 5 secondes, d’une attente de verrou de 500 ms et d’un budget global d’environ une minute. Il lit par blocs de 500 avec une pause entre les blocs, jusqu’à 100 000 articles. Ces limites réduisent la charge mais ne garantissent pas l’absence d’impact : une requête peut parcourir beaucoup de données avant de retourner son premier bloc.

## 4. Premier import manuel, en environnement de test

Récupérer la branche dans Cursor et installer les dépendances. Si elle est déjà ouverte sans modifications locales :

```bash
git pull --ff-only
npm ci
npm run build
npm run marketing:secrets
```

Le générateur refuse d’écraser `.env.marketing.local` s’il existe : conserver le fichier existant dans ce cas. Ajouter dans ce fichier privé :

```dotenv
MARKETING_DATABASE_URL=CONNEXION_SUPABASE_DE_TEST
NEON_ERP_DATABASE_URL=CONNEXION_NEON_DE_TEST_EN_LECTURE_SEULE
MARKETING_SYNC_ENABLED=true
WHATSAPP_DEFAULT_COUNTRY=DZ
```

Puis lancer `npm run marketing:sync`. Seuls un nombre d’articles ou un message d’échec générique sont affichés. Vérifier les produits/pointures et commandes sur la copie. Un import partiel n’est jamais publié ; la copie précédente reste disponible. Un nouvel import complet réconcilie les suppressions et les changements de statut. Les consentements et désinscriptions Supabase ne sont jamais écrasés.

## 5. Configurer Vercel après validation

Conserver les variables Supabase actuelles du site. Aucun secret ne doit être préfixé `VITE_`.

| Variable serveur Vercel | Valeur |
| --- | --- |
| `MARKETING_DATABASE_URL` | Connexion privée au Supabase AutoGet, Session/5432 ou directe |
| `MARKETING_ORIGIN` | Origine HTTPS stable du site |
| `MARKETING_ADMIN_PASSWORD_HASH` | Générée dans le fichier privé |
| `MARKETING_SESSION_SECRET` | Générée dans le fichier privé |
| `CRON_SECRET` | Générée dans le fichier privé |
| `WHATSAPP_VERIFY_TOKEN` | Générée dans le fichier privé |
| `WHATSAPP_ACCESS_TOKEN` | Jeton système Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Identifiant WABA |
| `WHATSAPP_APP_SECRET` | Secret Meta |
| `WHATSAPP_GRAPH_VERSION` | Version Graph prise en charge par l’application Meta |
| `WHATSAPP_DEFAULT_COUNTRY` | `DZ` |
| `WHATSAPP_MESSAGES_PER_SECOND` | `1` |
| `WHATSAPP_SENDING_ENABLED` | `false` au début |
| `NODE_ENV` | `production` |

**Ne pas mettre les accès Neon sur Vercel.** `NEON_ERP_VIEW` n’est plus utilisé.
Garder `ADMIN_PASSWORD_LOCAL_ONLY` dans un gestionnaire de mots de passe ; ne pas le copier dans Vercel.

Conserver Vite et la sortie `dist`. Utiliser Node 22 et Fluid Compute pour la fonction de 300 secondes. La branche Preview ne peut pas envoyer de messages. Fusionner dans `main` seulement après validation ; cette fusion déclenche la production. Redéployer après un changement de variables.

## 6. Programmer l’import après le test de charge

Dans GitHub → Settings → Secrets and variables → Actions :

- Secrets `NEON_ERP_DATABASE_URL` (compte de lecture) et `MARKETING_DATABASE_URL` (compte marketing Supabase).
- Variable `MARKETING_SYNC_ENABLED=true` uniquement après validation.

Le workflow **WhatsApp ERP snapshot** permet un lancement manuel et prévoit un import quotidien à 02:17 UTC. Il est désactivé par défaut. Il ne peut pas se chevaucher avec lui-même et la base bloque aussi deux imports concurrents. Un succès datant de moins d’une heure évite une nouvelle connexion à l’ERP. GitHub peut retarder les horaires ; les programmations ne fonctionnent que sur la branche par défaut.

La copie n’est pas en temps réel : un changement ERP est visible au prochain import. Après 48 heures sans import réussi, les envois restent en attente. L’écran affiche la date, le nombre d’articles et les erreurs d’import.

## 7. Programmer les envois et configurer Meta

Dans GitHub, ajouter le secret `CRON_SECRET` identique à Vercel, les variables `MARKETING_ORIGIN` et `MARKETING_WORKER_ENABLED=true`. Exécuter manuellement **WhatsApp campaign worker** et vérifier le passage dans l’écran marketing. Le workflow traite les messages environ toutes les cinq minutes depuis Supabase. Il ne lit jamais Neon.

Configurer le webhook Meta à `https://VOTRE-SITE/api/whatsapp/webhook`, avec `WHATSAPP_VERIFY_TOKEN`, souscrire à `messages` et abonner l’application au WABA.

La livraison d’une commande ne prouve pas le consentement marketing. Importer uniquement les consentements documentés dans `marketing.consents`. Commencer avec un seul numéro de test consentant et un modèle approuvé. Activer ensuite explicitement `WHATSAPP_SENDING_ENABLED=true`, redéployer, préparer et lancer cette campagne de test.

## Arrêt et diagnostic

- Couper les imports : variable GitHub `MARKETING_SYNC_ENABLED=false` (une exécution déjà engagée finit ou doit être annulée).
- Couper les nouveaux envois : mettre en pause les campagnes ; désactiver les envois et le worker pour un arrêt durable. Un message déjà accepté par Meta ne peut pas être rappelé.
- Import échoué : examiner les permissions et les métriques dans les outils privés ; ne pas publier d’identifiants ni de lignes clients dans les logs.
- Limite ou délai dépassé : aucun import partiel publié, conserver l’ancienne copie ; ne pas élargir les limites sans analyser la charge.

Référence connexion : [Supabase — modes PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Mise à jour des campagnes de 60 000 contacts

Pour une base marketing déjà installée, exécuter **uniquement** `sql/whatsapp-throughput.sql` sur Supabase avant de déployer cette version. Ce fichier ajoute une date de pause pour les limites Meta et un index de file ordonné ; il ne touche pas Neon. L’installateur neuf comprend déjà la colonne.

La préparation accepte 60 000 contacts éligibles et insère les messages par blocs de 500 dans une seule transaction. Le worker garde une seule connexion coordinatrice Supabase et jusqu’à 20 requêtes Meta simultanées. Chaque départ est espacé selon `WHATSAPP_MESSAGES_PER_SECOND` (1 au départ, jusqu’à 20 après vérification et tests). Un seul coordinateur peut envoyer par base ; les autres invocations quittent le traitement. Avant chaque tentative, la requête vérifie consentement, exclusions, pause de campagne et fraîcheur de la copie. Les tentatives déjà prises en charge peuvent finir après une pause.

Un refus de débit Meta 130429/HTTP 429 inscrit une pause de 30 secondes partagée en base. Les requêtes déjà parties finissent ; les tentatives incertaines ne sont pas renvoyées automatiquement. Le traitement attend la fin des requêtes engagées avant de libérer le verrou. Si Vercel interrompt la fonction, les tentatives non confirmées restent à vérifier.

Chaque passage démarre des tentatives pendant 240 secondes maximum puis laisse finir les requêtes en cours, sous la limite de fonction de 300 secondes. Avec un réveil GitHub toutes les cinq minutes, il reste des pauses et d’éventuels retards. À 20 départs/seconde réellement atteints, 60 000 messages représenteraient 50 minutes actives, environ 65 minutes avec ces pauses régulières ; la latence Supabase/Meta, les erreurs et les restrictions peuvent allonger cette durée. Ce n’est pas un délai garanti. La limite de 100 000 destinataires/24 h déclarée par le propriétaire n’est pas un débit et peut être partagée avec ses autres usages Meta.

La copie ERP reste plafonnée à **100 000 lignes d’articles**, ce qui peut représenter moins de 60 000 clients distincts. Cette mise à jour n’augmente pas la charge autorisée sur l’ERP. Mesurer la couverture lors de l’import ; si les limites sont dépassées, adapter séparément l’import après contrôle sur une copie/réplique. Ne pas promettre 60 000 contacts éligibles à partir du seul volume brut ERP.

Validation locale : préparation d’une campagne de 60 000 contacts fictifs, concurrence d’envois simulés, contrôle des espacements, absence de doublons entre coordinateurs, pause et refus de débit persistants. Aucun test de charge ni envoi réel sur les comptes du propriétaire.

### Certificat Supabase pour le serveur

La connexion TablePlus a nécessité le certificat CA téléchargé dans Supabase. Pour le serveur aussi, ajouter `MARKETING_DATABASE_CA_CERT` dans Vercel avec le contenu PEM complet du fichier, lignes BEGIN/END incluses. Le programme accepte les vrais retours à la ligne ou `\n`. Conserver `sslmode=verify-full` dans l’URL ; le code conserve la CA et la vérification TLS malgré les options de l’URL. Le chemin local du certificat TablePlus ne peut pas être utilisé sur Vercel. Ajouter la même variable comme secret du workflow d’import GitHub. Ce certificat CA est public, contrairement au mot de passe et à la chaîne de connexion complète.

### Connexion sur Preview

Conserver `MARKETING_ORIGIN` pour le domaine de production. En Preview, le serveur accepte également les deux origines HTTPS exactes fournies par Vercel (`VERCEL_URL` et `VERCEL_BRANCH_URL`). Aucun domaine arbitraire ni en-tête Host ne sert à autoriser une origine. Activer l’exposition des variables système Vercel et rendre les variables marketing disponibles pour Preview, puis redéployer. Les envois restent bloqués sur Preview.
