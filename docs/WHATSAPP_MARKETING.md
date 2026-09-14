# WhatsApp Marketing — AutoGet

**Installation Vercel/Cursor : commencer par [ce guide pas à pas](VERCEL_WHATSAPP_SETUP.md).**

## État de l’intégration

Module ajouté sur la branche `feat/whatsapp-marketing`. L’application existante est une SPA React 19 / Vite 7, avec Tailwind et composants Radix. La navigation est pilotée par `activeView` dans `src/App.jsx`, les titres par `src/constants/viewTitles.js` et les données métier par `DataContextSupabase.jsx`.

Le dépôt utilise **Supabase**, pas Neon. Les tables existantes sont notamment `produits`, `fournisseurs`, `entrees`, `paiements`, `depenses`, `colis`, `salaries` et `acomptes`. Les entrées décrivent des réceptions de stock ; `colis` contient une quantité, une date et une description. Il n’existe ici ni modèle de commande client individuelle, ni téléphone client, ni pointure vendue. La base Neon appartient à l’ERP externe de traitement des commandes, comme confirmé par le propriétaire.

Le schéma ERP et ses clés étrangères ont maintenant été fournis : la lecture réelle est implémentée dans `server/marketing/erp-source.sql`, sans vue à installer. Aucun identifiant Neon/Meta n’a été fourni. **Le module n’est donc pas raccordé à la base de production.** Aucun changement, aucune migration et aucun message n’ont été exécutés dans les systèmes de production.

## Architecture

```text
AutoGet / WhatsApp Marketing (administrateurs)
              │ même origine, cookie HttpOnly
              ▼
Serveur Node / Express ─── SELECT ──► Supabase : copie privée des achats
              │
              ├── Supabase marketing : brouillons, destinataires, logs, exclusions
              ├── Cloud API Meta : modèles + messages
              └── Worker persistant ← webhooks signés Meta
```

L’import séparé (Cursor ou workflow GitHub quotidien) lit Neon en transaction READ ONLY puis remplace atomiquement la copie Supabase. Le serveur Vercel et les workers ne possèdent plus de connexion ERP.

Le serveur peut servir le build Vite existant. En développement, Vite transmet `/api/marketing` et `/api/whatsapp` vers le port 3001. Sur Vercel, `api/marketing.js` expose le serveur sans listener permanent ; `vercel.json` transmet uniquement les routes API à cette fonction. Le frontal et les API restent sur la même origine. GitHub Actions appelle le worker par lots bornés toutes les cinq minutes environ. Hors Vercel, le processus Node permanent reste disponible.

Le serveur conserve la compatibilité CSP avec l’origine Supabase et les polices du projet. Configurez `VITE_SUPABASE_URL` à l’exécution **et** à la compilation si vous changez l’instance existante.

## Raccordement et migrations

Suivre uniquement le [guide Supabase à jour](VERCEL_WHATSAPP_SETUP.md). L’installation neuve `sql/whatsapp-supabase-install.sql` crée un schéma privé, active RLS et prépare un groupe serveur limité à ce schéma. Elle refuse toute collision et ne modifie aucune table historique. La connexion serveur doit appartenir uniquement à ce groupe, sans privilèges d’administration. Session pooler Supabase port 5432 ou connexion directe requis ; le pooler Transaction/6543 est incompatible avec les verrous du worker.

Aucun script de vue n’est désormais nécessaire sur Neon. `sql/whatsapp-erp-reader.sql` prépare uniquement des droits SELECT par colonne ; les comptes, droits hérités et accès PUBLIC doivent être contrôlés avant attribution. Les scripts de vue historiques restent dans le dépôt pour référence et tests, pas pour la nouvelle installation.

Le processus d’import possède les deux connexions, jamais le navigateur. `sql/whatsapp-supabase-sync.sql` est un élément de migration pour les anciennes installations, à examiner avec leurs politiques/rôles existants ; l’installateur neuf l’inclut déjà.

Colonnes du résultat importé :

| Colonne | Type / sens |
| --- | --- |
| `order_id` | Texte, identifiant stable et unique de commande |
| `ordered_at` | Date/heure de commande avec fuseau |
| `status` | Statut ERP traduit en `delivered`, `livré` ou `livre` |
| `phone` | Texte ; E.164 recommandé |
| `customer_name` | Nom client |
| `product_id`, `product_name` | Identifiant stable et libellé du produit acheté |
| `variant`, `size` | Variante et pointure de la ligne achetée |
| `city` | Ville du contact |
| `marketing_opt_in` | Booléen : consentement marketing **actuel** |

La requête joint les commandes, clients, lignes et variantes réels de l’ERP, une ligne par combinaison achetée. Utilisez les libellés historiques lorsqu’ils existent. Les unités de pointure restent telles que stockées : `42`, `42 EU` et `8 UK` ne sont pas converties implicitement.

Le consentement provient exclusivement du registre privé Supabase, pas d’un ancien champ de commande. Un statut livré ne constitue pas ce consentement. L’import force marketing_opt_in à false et ne modifie jamais le registre. Les réponses STOP et les désinscriptions manuelles priment sur ce registre.

## Configuration

Copier `.env.example` dans `.env` (ignoré par Git). Les secrets **ne doivent jamais** avoir le préfixe `VITE_`.

| Variable | Utilisation |
| --- | --- |
| `MARKETING_DATABASE_URL` | Supabase AutoGet, connexion privée Session/5432 ou directe |
| `NEON_ERP_DATABASE_URL` | Import uniquement : connexion ERP en lecture seule, absente de Vercel |
| `MARKETING_SYNC_ENABLED` | Import uniquement : false par défaut, activation après essai isolé |
| `MARKETING_ORIGIN` | Origine exacte du frontal, ex. `https://autoget.example` |
| `MARKETING_PORT` | Port serveur, défaut 3001 ; adapter aussi le proxy Vite si changé |
| `MARKETING_ADMIN_PASSWORD_HASH` | Hash scrypt `sel_hex:hash_hex` |
| `MARKETING_SESSION_SECRET` | Secret aléatoire d’au moins 32 caractères |
| `WHATSAPP_ACCESS_TOKEN` | Jeton de compte système Meta, côté serveur uniquement |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro expéditeur |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Identifiant WABA |
| `WHATSAPP_GRAPH_VERSION` | Version Graph prise en charge par votre application, explicite (`v25.0` dans l’exemple) |
| `WHATSAPP_APP_SECRET` | Secret de l’application Meta, vérification HMAC |
| `WHATSAPP_VERIFY_TOKEN` | Valeur aléatoire pour la validation du webhook |
| `WHATSAPP_DEFAULT_COUNTRY` | Code pays des numéros locaux, défaut `DZ` |
| `WHATSAPP_MESSAGES_PER_SECOND` | Plafond global configuré, défaut 1, maximum 20 ; débit réel inférieur selon la latence Supabase/Meta |
| `WHATSAPP_SENDING_ENABLED` | `false` par défaut ; `true` autorise le lancement et le worker |
| `NODE_ENV` | `production` pour cookies Secure et origine HTTPS obligatoire |

Pour produire le hash sans enregistrer le mot de passe dans l’historique du terminal :

```bash
read -s -p 'Mot de passe marketing : ' MARKETING_PASSWORD
export MARKETING_PASSWORD
node --input-type=module -e 'import {randomBytes,scryptSync} from "node:crypto"; const salt=randomBytes(16).toString("hex"); console.log(salt+":"+scryptSync(process.env.MARKETING_PASSWORD,salt,64).toString("hex"))'
unset MARKETING_PASSWORD
```

Coller uniquement le hash résultant dans `MARKETING_ADMIN_PASSWORD_HASH`. Générer les autres secrets aléatoires localement, par exemple avec `openssl rand -hex 32`, et les enregistrer dans le gestionnaire de secrets de l’hébergeur.

```bash
npm ci
npm run dev                 # premier terminal
npm run marketing:server    # second terminal, charge .env
```

Production : `npm run build`, puis `NODE_ENV=production npm run marketing:server` (ou `node server/marketing/index.js` si l’hébergeur injecte déjà toutes les variables). Superviser et redémarrer automatiquement le processus.

L’authentification historique de l’application utilise `comptes` puis un objet utilisateur dans `localStorage`, sans session serveur vérifiable. Le module ajoute donc un mot de passe administrateur marketing indépendant, un cookie signé HttpOnly/SameSite=Strict valable huit heures, une vérification d’origine des mutations et une limitation des tentatives de connexion. Le rôle affiché par React ne remplace jamais cette vérification. L’authentification historique du reste d’AutoGet n’a pas été refondue. Rotation de `MARKETING_SESSION_SECRET` pour révoquer toutes les sessions. L’accès marketing est partagé ; les logs identifient les destinataires et événements, pas des administrateurs individuels.

## Meta : modèles et webhooks

Utiliser un compte WhatsApp Business, un numéro configuré et un jeton disposant de `whatsapp_business_management` et `whatsapp_business_messaging`.

Dans Meta, configurer :

- Callback HTTPS : `https://VOTRE_ORIGINE/api/whatsapp/webhook`.
- Verify token : valeur de `WHATSAPP_VERIFY_TOKEN`.
- Abonnement au champ `messages` et abonnement de l’application au WABA (`POST /{WABA_ID}/subscribed_apps`).

Les requêtes POST sont validées avec `X-Hub-Signature-256` sur le corps brut. Les événements d’un autre WABA/numéro sont ignorés. Les doublons sont dédupliqués et une lecture ne régresse pas à « envoyé ». Le `biz_opaque_callback_data` permet de retrouver un destinataire même si le webhook précède l’enregistrement de l’identifiant Meta. Les corps complets des webhooks et les jetons ne sont pas journalisés.

L’onglet Modèles liste les modèles Meta avec pagination complète et leur statut. La création soumet un modèle marketing avec texte, exemples de variables, image JPEG/PNG facultative et un bouton URL fixe facultatif à Meta. **L’application ne peut pas approuver un modèle.** Les modèles approuvés à corps texte et en-tête texte sont utilisables, avec paramètres positionnels ou nommés. Les en-têtes IMAGE sont utilisables avec un lien HTTPS public à renseigner pour la campagne. Les boutons URL fixes et PHONE_NUMBER sont repris depuis le modèle approuvé sans paramètres supplémentaires. Un bouton URL dynamique accepte une variable {{1}} en fin de lien ; renseigner uniquement son suffixe. Les indices des boutons sont conservés, y compris dans les modèles mixtes. Vidéos, documents, réponses rapides, carrousels et autres formats restent signalés comme non pris en charge et bloqués à l’envoi. L’édition/suppression de modèles existants s’effectue dans WhatsApp Manager ; actualiser ensuite l’interface.

Références officielles consultées : [collection Cloud API de Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [exemples officiels Meta, notamment validation des signatures](https://github.com/fbsamples/whatsapp-api-examples), [documentation des messages templates](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/).

## Fonctionnement et reprise

- Lecture des lignes livrées ; normalisation des numéros avec `libphonenumber-js`, défaut Algérie. Numéros invalides exclus et comptabilisés en **lignes**, pas en clients.
- Un contact par téléphone normalisé. Les commandes sont comptées une seule fois, les produits/variantes/pointures de l’historique sont conservés. Un téléphone familial commun correspond à un contact, pas nécessairement une personne distincte.
- Produit + pointure + variante + période doivent correspondre à **la même ligne d’achat**. Le nombre de commandes couvre tout l’historique livré, pas seulement la période filtrée. Dates filtrées par jour UTC ; nom/ville de la dernière commande.
- Sélection explicite ou tout le segment, y compris les autres pages, avec exclusions individuelles. Un changement de filtre réinitialise la sélection.
- Préparation : le serveur lit la copie Supabase, vérifie toutes les variables, ignore les contacts inéligibles et crée transactionnellement un brouillon avec les messages exacts. Le nombre final peut différer de l’affichage si la copie ou les consentements ont changé. L’identifiant de requête et la contrainte campagne/téléphone évitent les doublons de préparation.
- Lancement distinct : vérifie que le modèle est encore approuvé et inchangé. Les messages déjà préparés ne sont pas modifiés implicitement par un changement de filtre ou de modèle dans le navigateur.
- Worker : verrou partagé en base, vérification indexée du contact, de la fraîcheur de la copie (48 h), du registre de consentements et des exclusions Supabase avant chaque tentative, enregistrement de la tentative avant l’appel Meta, cadence plafonnée.
- Un succès HTTP Meta est « Accepté par Meta ». Livraison et lecture sont confirmées par les webhooks.
- Rejets temporaires connus : reprise exponentielle avec aléa, cinq tentatives maximum. Le bouton de reprise ne réinitialise que les erreurs explicitement relançables sans identifiant Meta.
- Timeout réseau, réponse ambiguë ou arrêt après tentative : état « À vérifier », **sans renvoi automatique**. Examiner le journal et la console Meta. Il n’existe pas de garantie exactly-once intersystèmes ; ne recréer une campagne pour ces contacts qu’après vérification humaine de la non-livraison.
- Pause : empêche les prochains envois, mais ne rappelle pas une requête déjà partie. Reprendre avec « Lancer l’envoi ».
- STOP / UNSUBSCRIBE / DÉSINSCRIRE / ARRÊT et variantes sans accents sont traités comme désinscriptions ; bouton manuel disponible dans l’audience. La réinscription nécessite une vérification externe du consentement et une opération administrateur explicite sur la liste d’exclusion.

## Capacités et limites opérationnelles

L’interface lit uniquement la copie Supabase, jusqu’à 250 000 articles. Le worker fait une recherche par téléphone indexée, sans reconstruire toute l’audience. Une campagne est limitée à 60 000 destinataires ; l’interface affiche 50 clients par page.

L’import complet quotidien est désactivé par défaut, borné à 100 000 lignes, blocs de 500, pause de 20 ms, une connexion ERP, 5 s par requête, 500 ms d’attente de verrou, budget applicatif 60 s et transaction_timeout 75 s sur PostgreSQL 17+. Il utilise un curseur dans un snapshot cohérent, sans DDL, index ni modification de données ERP. Une transaction Supabase publie le résultat complet ou conserve la copie précédente. Un verrou transactionnel empêche les imports concurrents ; un succès de moins d’une heure évite une nouvelle lecture. La transaction ERP peut maintenir un snapshot/verrou de lecture pendant sa durée : surveiller les métriques et tester sur une branche avec calculateur séparé. Les blocs limitent le transfert, pas nécessairement le travail du plan SQL avant le premier résultat. Aucun index n’est ajouté automatiquement à l’ERP.

Les suppressions, annulations et changements d’articles sont réconciliés au prochain snapshot complet. L’historique n’est donc pas en temps réel. Les données deviennent périmées après 48 h sans succès : les messages restent en attente sans consommation de tentative. La présence d’une erreur d’import est visible ; elle ne renouvelle pas la date du dernier succès. Pour plus de volume ou si le délai ne suffit pas, revoir le plan sur la copie et prévoir une réplique/CDC plutôt qu’augmenter aveuglément la charge sur l’ERP.

La liste affiche les 100 dernières campagnes ; les destinataires restent consultables par pages et le journal affiche les 100 derniers événements de la campagne. Les totaux du tableau de bord portent sur ces campagnes affichées. Aucun mécanisme automatique de conservation/purge n’est installé : définir une durée de conservation adaptée pour les numéros et messages personnalisés stockés en base.

Plusieurs invocations sur la même base via Session pooler ou connexion directe partagent le verrou et le plafond. La limitation des connexions administrateur est partagée en PostgreSQL : dix tentatives par fenêtre de quinze minutes pour cet accès commun. La connexion du worker est fermée après chaque cycle ; un délai d’inactivité de session borne les verrous orphelins. Les tentatives interrompues sont classées incertaines après cinq minutes. Le plafond s’applique aux envois de ce service, pas à d’autres applications utilisant le même numéro Meta.

Ne pas utiliser une URL Postgres de production pour les tests ci-dessous.

## Vérifications

```bash
npm run build
npm run test:marketing
npx eslint src/components/WhatsAppMarketing.jsx server/marketing/*.js tests/marketing/*.js
```

Les tests unitaires couvrent numéros, déduplication, association produit/pointure, dates, consentement contradictoire, variables, ordre des statuts, signature HMAC, session et pagination Meta.

La suite d’intégration nécessite une base PostgreSQL **jetable** dans `MARKETING_TEST_DATABASE_URL`. Elle tronque les tables marketing et une table ERP fictive, puis vérifie migrations réexécutables, authentification, protection d’origine, préparation concurrente, workers concurrents, activation des envois, reprise, incertitude, désinscription et webhooks. L’API Meta est simulée : aucun message réel n’est envoyé.

```bash
MARKETING_TEST_DATABASE_URL=postgresql://UTILISATEUR@127.0.0.1:PORT/BASE_JETABLE npm run test:marketing
```

Sans cette variable, la suite d’intégration est explicitement ignorée. À la livraison, elle a également été exécutée avec succès sur un PostgreSQL local isolé. Le lint global du dépôt présente des erreurs préexistantes hors du module ; les fichiers du nouveau module sont contrôlés séparément.

## Mise en service restante

1. Tester l’installation Supabase et l’import sur des copies isolées ; mesurer la charge.
2. Vérifier les comptes restreints et droits effectifs, puis préparer Supabase AutoGet.
3. Configurer l’import séparé, les secrets Vercel sans Neon, le compte Meta et le webhook.
4. Vérifier la copie, un modèle approuvé et un destinataire de test consentant.
5. Activer les automatismes uniquement après validation, puis lancer explicitement la campagne voulue.


## Raccordement ERP confirmé et règles d'historique

La requête d’import utilise les clés étrangères fournies :

```text
woo_orders.id ← delivered_order_items.woo_order_id
                   └ product_variant_id → product_variants.id
                                            └ product_id → products.id
```

- Statut : `woo_orders.order_status = 'delivered'`, suppression exclue.
- Pointure : `product_variants.size`, convertie en texte sans changement d'unité.
- Variante affichée : `product_variants.color`.
- Produit interne : `products.name`, identifiant préfixé `erp:`.
- Téléphone : `phone_normalized` vérifié avec la bibliothèque de numéros ; repli sur `customer_phone` s'il est invalide. `customer_phone2` ne crée pas un second destinataire.
- Nom/ville : facturation, puis livraison si le champ de facturation est vide.
- Date de filtre : `date_created`, avec `created_at` comme repli historique si absent. Une absence des deux dates est une erreur de qualité de données, pas une date inventée.

Les sources sont choisies **par commande** : articles livrés actifs en priorité,
lignes `confrimed_order_items` actives seulement si aucune ligne de livraison
active n'existe, puis lignes WooCommerce si aucune des deux sources internes
n'existe. Les quantités explicitement nulles restent inconnues ; les quantités
nulles au sens numérique (zéro) ou négatives ne sont pas comptées comme achat.
Les lignes confirmées ne sont jamais ajoutées aux livraisons partielles : cela
évite de présenter une taille seulement prévue comme effectivement livrée.

La provenance et la quantité apparaissent dans l'historique client. Les commandes
sans ligne exploitable restent visibles avec « Détail manquant ». Les données
catalogue supprimées logiquement restent disponibles pour les achats historiques.
Les libellés/couleurs proviennent du catalogue actuel, sans garantie de snapshot
au moment de l'achat si ces valeurs ont été modifiées dans l'ERP.

Les archives WooCommerce ne sont pas jointes par égalité numérique à la variante
interne : leurs pointures restent inconnues. Leurs produits ont un identifiant
séparé `woo-company:<company_id>:<product_id>` et ne sont pas fusionnés par simple
ressemblance de nom avec le catalogue interne. Une commande avec plusieurs lignes
livrées ne compte que comme une commande, mais ses différentes lignes sont
conservées grâce à leur identifiant de source.

Les commandes d'échange livrées sont incluses. L'historique décrit les articles
livrés, **pas un calcul du stock conservé par le client après remboursements**.
Les tables de retours et remboursements ont été identifiées, mais leurs valeurs
de statut métier n'ont pas été fournies : une demande de remboursement ne prouve
pas qu'un retour a été effectué, ni qu'un remplacement a été livré. La requête ne
soustrait donc pas arbitrairement ces lignes et n'invente pas de remplacement.

## Consentements avec cet ERP

Aucun champ explicite de consentement WhatsApp actuel n'a été trouvé dans les
colonnes ou clés de métadonnées communiquées. L’import impose donc
`marketing_opt_in=false` : tous les clients livrés peuvent être consultés et
segmentés, mais seuls ceux ayant une autorisation enregistrée sont éligibles.

Le registre privé `marketing.consents` peut recevoir un import de consentements
vérifiés : `phone` E.164, `opted_in` booléen, `evidence` (référence de la preuve),
`captured_at` (date de collecte), `updated_at`. L'import doit être paramétré et
réalisé côté serveur ou par l'administrateur de base ; aucun import réel n'a été
effectué. Un enregistrement du registre remplace la préférence par défaut de la copie ; une
révocation y est enregistrée avec `opted_in=false`. Une exclusion STOP prime dans
tous les cas. Ne pas alimenter ce registre automatiquement à partir du statut livré.

## Tests du raccordement

Les suites comprennent l’adaptateur ERP, les campagnes, l’import transactionnel, la fraîcheur, les annulations et les droits du schéma privé. L'adaptateur est exécuté deux fois sur des tables fictives reproduisant
les colonnes utilisées, dans des schémas isolés de la base de test. Les contrôles
couvrent priorité de la variante livrée, repli confirmé, absence de correspondance
inventée avec les IDs Woo, commandes sans détail, suppression, quantité zéro et
catalogue archivé. Les tests serveur couvrent aussi le repli téléphonique et la
priorité du consentement actuel et des désinscriptions.

Sur Vercel, chaque lot démarre des cycles pendant au plus 240 secondes, puis laisse finir le dernier cycle avant la limite de fonction de 300 secondes. Les passages sont authentifiés avec `CRON_SECRET`, interdits en Preview et suivis dans `marketing.worker_health`. Le lancement exige un passage réussi de moins de 20 minutes. Un service défaillant laisse la file en base ; les tentatives ambiguës ne sont jamais relancées automatiquement.

## Mise à jour des campagnes de 60 000 contacts

Pour une base marketing déjà installée, exécuter **uniquement** `sql/whatsapp-throughput.sql` sur Supabase avant de déployer cette version. Ce fichier ajoute une date de pause pour les limites Meta et un index de file ordonné ; il ne touche pas Neon. L’installateur neuf comprend déjà la colonne.

La préparation accepte 60 000 contacts éligibles et insère les messages par blocs de 500 dans une seule transaction. Le worker garde une seule connexion coordinatrice Supabase et jusqu’à 20 requêtes Meta simultanées. Chaque départ est espacé selon `WHATSAPP_MESSAGES_PER_SECOND` (1 au départ, jusqu’à 20 après vérification et tests). Un seul coordinateur peut envoyer par base ; les autres invocations quittent le traitement. Avant chaque tentative, la requête vérifie consentement, exclusions, pause de campagne et fraîcheur de la copie. Les tentatives déjà prises en charge peuvent finir après une pause.

Un refus de débit Meta 130429/HTTP 429 inscrit une pause de 30 secondes partagée en base. Les requêtes déjà parties finissent ; les tentatives incertaines ne sont pas renvoyées automatiquement. Le traitement attend la fin des requêtes engagées avant de libérer le verrou. Si Vercel interrompt la fonction, les tentatives non confirmées restent à vérifier.

Chaque passage démarre des tentatives pendant 240 secondes maximum puis laisse finir les requêtes en cours, sous la limite de fonction de 300 secondes. Avec un réveil GitHub toutes les cinq minutes, il reste des pauses et d’éventuels retards. À 20 départs/seconde réellement atteints, 60 000 messages représenteraient 50 minutes actives, environ 65 minutes avec ces pauses régulières ; la latence Supabase/Meta, les erreurs et les restrictions peuvent allonger cette durée. Ce n’est pas un délai garanti. La limite de 100 000 destinataires/24 h déclarée par le propriétaire n’est pas un débit et peut être partagée avec ses autres usages Meta.

La copie ERP reste plafonnée à **100 000 lignes d’articles**, ce qui peut représenter moins de 60 000 clients distincts. Cette mise à jour n’augmente pas la charge autorisée sur l’ERP. Mesurer la couverture lors de l’import ; si les limites sont dépassées, adapter séparément l’import après contrôle sur une copie/réplique. Ne pas promettre 60 000 contacts éligibles à partir du seul volume brut ERP.

Validation locale : préparation d’une campagne de 60 000 contacts fictifs, concurrence d’envois simulés, contrôle des espacements, absence de doublons entre coordinateurs, pause et refus de débit persistants. Aucun test de charge ni envoi réel sur les comptes du propriétaire.

### Certificat Supabase pour le serveur

La connexion TablePlus a nécessité le certificat CA téléchargé dans Supabase. Pour le serveur aussi, ajouter `MARKETING_DATABASE_CA_CERT` dans Vercel avec le contenu PEM complet du fichier, lignes BEGIN/END incluses. Le programme accepte les vrais retours à la ligne ou `\n`. Conserver `sslmode=verify-full` dans l’URL ; le code conserve la CA et la vérification TLS malgré les options de l’URL. Le chemin local du certificat TablePlus ne peut pas être utilisé sur Vercel. Ajouter la même variable comme secret du workflow d’import GitHub. Ce certificat CA est public, contrairement au mot de passe et à la chaîne de connexion complète.

### Images et boutons dans les modèles existants

Dans « 02 · Message », choisir le modèle approuvé puis renseigner le lien HTTPS de l’image JPEG/PNG, accessible sans connexion pendant toute la campagne. Le serveur transmet le lien à Meta sans télécharger l’image lui-même ; un lien syntaxiquement correct ne prouve pas que le média est accessible ou accepté par Meta. L’aperçu affiche l’image et le texte des boutons, avec leur destination. Les liens fixes du modèle sont conservés. Les liens variables proposent les mêmes sources que les variables texte (texte personnalisé ou donnée client). Les exemples médias de création du modèle ne sont pas réutilisés comme images d’envoi.

Aucune migration SQL ni nouvelle variable d’environnement. La création depuis AutoGet accepte une image JPEG/PNG choisie sur ordinateur (1 Mo maximum) et un bouton à lien HTTPS fixe avec un texte de 25 caractères maximum. Le serveur valide tous les champs avant le transfert binaire via Meta Resumable Upload (`app/uploads`, puis session avec `file_offset: 0`), puis utilise le handle comme exemple d’en-tête pour la soumission. Le handle de validation ne remplace pas le lien image à renseigner lors de l’envoi. Aucun fichier image n’est stocké dans Supabase. Aucun nouvel identifiant serveur à configurer ; l’application est déterminée par le jeton Meta. Une erreur de transfert interrompt la création ; une réponse incertaine à la soumission nécessite de vérifier les modèles existants avant de réessayer. Valider un envoi réel sur un numéro de test avant une campagne. Structure API : https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/TemplateObject/

### Import tous statuts et filtre de commande

L’import actif (`server/marketing/erp-source.sql`) inclut maintenant toutes les commandes non supprimées. `order_status` est prioritaire ; si vide, repli sur `status`, puis `unknown`. Casse et espaces sont normalisés. Les anciens scripts de vues « delivered » restent historiques et ne sont pas utilisés par l’import. Un compte ayant des droits par colonne doit aussi pouvoir lire `woo_orders.status` ; le compte existant `ai_analyst` testé avec SELECT sur la table couvre déjà cette colonne.

L’audience propose « Statut de la commande », par défaut tous. Statut, produit, variante, pointure et période doivent correspondre à la même ligne de commande. Le statut apparaît dans l’historique, qui reste complet ; le nombre de commandes affiché et les filtres min/max portent sur tout cet historique. Les statuts inhabituels sont conservés dans la liste. Les lignes livrées sont prioritaires, puis confirmées, puis Woo, comme auparavant ; une commande sans ligne exploitable est conservée avec des champs produit/pointure inconnus.

Aucune migration SQL. Après mise à jour du code local (`git pull --ff-only`), relancer `npm run marketing:sync` pour remplacer atomiquement la copie livrée par la copie tous statuts. Le garde-fou d’une heure entre imports reste actif. Le plafond devient 250 000 lignes, avec une pause de 20 ms par bloc de 500 ; le budget global de 60 secondes, les délais de requête et la connexion source unique restent en place. En cas de dépassement, la copie précédente est conservée. Une validation locale ne garantit pas le temps du premier import tous statuts sur l’ERP réel.

Les consentements et exclusions existants sont conservés. Aucun accord automatique n’est créé pour les nouveaux contacts. Les campagnes déjà préparées gardent leurs destinataires ; recréer un brouillon pour appliquer un nouveau filtre.

## Statistiques et coûts des campagnes

Dans le détail d’une campagne, « Résultats de la campagne » propose une vue
 d’ensemble, les coûts en EUR et les destinataires filtrables avec export CSV.
La mise à jour est manuelle. Les compteurs portent sur toute la campagne ; la
recherche et le filtre de statut portent uniquement sur le tableau et son export.

- Acceptés : identifiant de message Meta ou événement de succès disponible.
- Livrés : confirmation delivered ou read ; les lus sont inclus.
- Lus : confirmations disponibles, pas une mesure exhaustive des ouvertures.
- Les statuts actuels sont exclusifs ; les étapes acceptés/livrés/lus se recouvrent.
- Livraison = livrés / acceptés ; lecture = lus / livrés ; échecs = échecs actuels /
  destinataires ayant une tentative ou une acceptation. Sans dénominateur, aucun taux.
- La chronologie compte le premier événement de chaque étape par destinataire,
  en UTC. Les détails utilisent le fuseau du navigateur. Les événements anciens
  sans date Meta utilisent leur date de réception. Les délais ne portent que sur
  les paires d’événements connues, dans l’ordre chronologique.

Les webhooks signés conservent maintenant la date et les champs de facturation
`billable`, `category`, `type`, `pricing_model`. Aucun montant unitaire ne vient
 de ces champs. Sans webhook, une acceptation ne devient pas une livraison.
Aucune donnée historique absente n’est reconstruite artificiellement.

Chaque campagne possède ses tarifs configurables par pays et catégorie, en EUR
(jusqu’à six décimales). Le tarif du pays prime sur le tarif par défaut `*`.
Une livraison explicitement gratuite coûte zéro. Une livraison sans indication
 de facturation est estimée comme facturable, avec cette hypothèse affichée.
Les tarifs manquants et l’ancien modèle par conversation donnent une estimation
indisponible, avec un sous-total connu séparé. Les tentatives supplémentaires
ne multiplient pas les coûts. Le budget suppose tous les destinataires facturés.
Les coûts moyens divisent le total estimé par les acceptés ou par les livrés.

Le montant de facture est une saisie manuelle facultative avec source obligatoire,
jamais présenté comme récupéré automatiquement. Modifier les tarifs recalcule
l’estimation de cette campagne. Clics, ventes attribuées, chiffre d’affaires et ROI
restent explicitement non mesurés : aucune attribution automatique n’est ajoutée.

Avant de déployer cette version sur une base existante, exécuter
`sql/whatsapp-analytics.sql` dans **Supabase, base marketing**, avec son propriétaire.
La migration ajoute trois colonnes et un index, sans modifier les données ERP.
Elle est réexécutable et compatible avec l’ancienne application. Les installations
neuves incluent les colonnes ; exécuter également la migration pour l’index.

### Chiffres Meta automatiques (remplace la saisie des tarifs)

L’onglet **Chiffres Meta** remplace l’écran de coûts manuels. Il interroge les
API officielles `pricing_analytics` et `template_analytics` à l’ouverture et sur
actualisation, sur une période UTC de 31 jours maximum. La devise est lue sur
le compte WhatsApp ; elle n’est pas renommée EUR si Meta renvoie une autre devise.
Les appels restent sur le serveur avec le token existant et sont uniquement GET.

Les coûts/volumes par pays, numéro et catégorie concernent tout le compte.
Les envois, livraisons, lectures, clics et coûts du modèle concernent le modèle
sur la période, y compris ses utilisations hors AutoGet. Aucune attribution
exacte du total Meta à une campagne locale ou un destinataire n’est prétendue.
Les coûts Meta sont susceptibles d’être provisoires. Les métriques absentes ou
les erreurs d’autorisation sont visibles, jamais remplacées par des zéros.
La pagination reste sur Graph et une réponse partielle paginée est rejetée.

Les anciennes configurations de tarifs restent stockées pour compatibilité,
mais ne sont plus demandées dans l’interface. Aucun changement SQL supplémentaire.
Référence de contrat : SDK officiel Meta,
https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/whatsappbusinessaccount.py
(`get_pricing_analytics`, `get_template_analytics`, champ `currency`).
