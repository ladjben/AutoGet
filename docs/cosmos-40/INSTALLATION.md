# COSMOS : prénom WhatsApp et commande avec les anciennes coordonnées

Préparé pour https://autoget-tau.vercel.app/. Ces fichiers ne sont pas encore déployés.

## Résultat

L’employé peut associer la variable du message au « Prénom (premier mot du nom) » et celle du bouton au « Lien personnel COSMOS ». Chaque destinataire reçoit un code aléatoire distinct. Ouvrir le lien ne crée pas de commande.

La page cherche la dernière commande Shopify accessible correspondant au téléphone du destinataire. Elle montre uniquement la wilaya et les quatre derniers chiffres du téléphone. Le client choisit son modèle et sa livraison, coche la confirmation que son ancienne adresse reste valable, puis commande. Il peut aussi choisir de saisir de nouvelles coordonnées.

Si la recherche ne retrouve pas de coordonnées complètes, un téléphone de livraison identique et une wilaya reconnue, le formulaire classique reste disponible. Aucune adresse ne doit être devinée. La recherche Shopify reste à valider avec un ancien client réel avant de lancer une campagne.

## Installation, dans cet ordre

1. Déployer les modifications AutoGet avec `PERSONAL_LINKS_ENABLED=false` (ou sans cette variable).
2. Dans la base **marketing AutoGet**, exécuter `sql/whatsapp-personal-links.sql` une seule fois avec le rôle administrateur. Ne pas l’exécuter sur la base ERP. Elle ajoute une table, sa politique RLS et les droits du rôle serveur existant.
3. Ajouter les variables ci-dessous dans Vercel, uniquement pour **Production**, sans préfixe `VITE_`. Les identifiants Shopify restent côté serveur et ne doivent jamais être copiés dans le thème ou dans un message.
4. Sauvegarder le template Shopify actuel, puis copier `product.cosmos-40-dz.liquid` dans `templates/product.cosmos-40-dz.liquid`. Ce fichier complet utilise les images déjà présentes dans le thème et le webhook de commandes existant.
5. Activer `PERSONAL_LINKS_ENABLED=true` et redéployer AutoGet après configuration. Les déploiements Vercel Preview refusent les liens personnels, même si les variables de production y sont copiées.
6. Tester avec un seul destinataire interne avant toute campagne. Vérifier le résumé masqué, la modification d’adresse et, lors d’un test de commande explicitement décidé, le nom/téléphone/adresse dans Shopify puis dans l’ERP. Les tests automatiques n’envoient aucune commande réelle.

Variables Vercel :

```dotenv
PERSONAL_LINKS_ENABLED=true
PERSONAL_LANDING_URL=https://cosmos-algerie.com/products/عرض-خاص-لزبائن-cosmos-قياس-40
PERSONAL_SHOPIFY_SHOP=ui7v5n-pw.myshopify.com
PERSONAL_SHOPIFY_CLIENT_ID=<identifiant de l’application Shopify installée>
PERSONAL_SHOPIFY_CLIENT_SECRET=<secret de cette application>
PERSONAL_ORDER_WEBHOOK_URL=https://n8n.ikleelcos.com/webhook/cosmos-offre-40-commandes
```

Le client-credentials Shopify nécessite une application éligible appartenant à la même organisation que la boutique. La lecture nécessite `read_orders` et l’accès aux coordonnées protégées des commandes. L’accès aux commandes de plus de 60 jours nécessite également `read_all_orders` accordé par Shopify. Si l’accès échoue, le client utilise le formulaire normal. Aucun accès `read_customers` n’est utilisé.

## Modèle Meta et campagne AutoGet

Créer/faire approuver dans Meta un bouton « Consulter le site Web », URL dynamique :

```text
https://cosmos-algerie.com/products/عرض-خاص-لزبائن-cosmos-قياس-40?access={{1}}
```

L’exemple destiné à l’examen Meta doit être une URL complète avec un code fictif à la place de `{{1}}`, sans coordonnées de client. Un code fictif ne récupère aucune adresse. L’éditeur de nouveaux modèles intégré à AutoGet reste limité aux liens fixes : importer/actualiser le modèle créé dans Meta.

Dans la campagne AutoGet :

- `BODY.1` → **Prénom (premier mot du nom)**. Si le nom enregistré commence par le nom de famille, choisir le nom complet ou corriger la source.
- `BUTTON.0` → **Lien personnel COSMOS (configuration requise)** pour le premier bouton.
- Filtrer les anciens clients, pointure 40 ; vérifier l’aperçu et le consentement avant de lancer.

La variable du corps et celle du bouton sont distinctes même si Meta les affiche toutes deux `{{1}}`. Le bouton doit correspondre exactement à la landing configurée, avec `?access={{1}}` à la fin. Ne jamais mettre le prénom, le téléphone ou un ID de commande dans le lien.

## Fonctionnement et limites

- Liens valables 7 jours à partir de la préparation de la campagne ; après expiration, formulaire classique. Préparer la campagne près de l’envoi.
- Un lien autorise son détenteur à confirmer une seule commande vers les anciennes coordonnées : ne pas le partager. Les coordonnées complètes restent côté serveur ; le lien n’est pas une authentification forte du client.
- Le code aléatoire est conservé dans le payload du message pour l’envoyer à Meta. La table dédiée conserve son empreinte SHA-256. Ces payloads doivent donc être traités comme confidentiels.
- Après ouverture, le paramètre est retiré de l’adresse avant les scripts du thème ; il est conservé dans la session du navigateur. Les journaux du serveur Shopify/CDN peuvent néanmoins enregistrer l’URL initiale.
- Le serveur fige les coordonnées au premier aperçu. Le client confirme que cette adresse reste valable. S’il a déménagé, il doit utiliser « modifier les informations ».
- Les requêtes de création concurrentes sont verrouillées en base. Le même identifiant de demande est transmis au registre anti-doublon n8n existant. Une coupure réseau laisse la demande en vérification, sans nouvelle tentative automatique.
- Les états `review` ou `processing` persistants doivent être rapprochés du registre n8n et de Shopify par `request_id`. Ne jamais remettre un lien à zéro avant d’avoir vérifié l’absence de commande.
- 60 consultations/requêtes maximum par lien. Les destinataires désinscrits ne peuvent plus utiliser leur lien personnel.
- Les prix et variantes restent validés dans n8n ; le navigateur ne fournit pas de prix. Livraison stop desk 400 DA, domicile 600 DA.
- Ce parcours réutilise le workflow Shopify existant, sans modifier le webhook ERP. Sa réception effective doit être testée après installation.

Pour désactiver : `PERSONAL_LINKS_ENABLED=false`, puis redéployer. Les liens afficheront le formulaire classique.

Pour purger les coordonnées mémorisées après expiration, exécuter régulièrement en administration marketing :

```sql
UPDATE marketing.personal_links SET contact=NULL WHERE expires_at < now() AND contact IS NOT NULL;
```

Conserver les états et les identifiants des demandes pour les rapprochements ; appliquer également la politique de rétention existante aux payloads des campagnes. Cette purge n’est pas planifiée automatiquement par ce changement.

Références techniques : [recherche des commandes Shopify](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders), [objet Order et accès aux anciennes commandes](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order), [client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant).
