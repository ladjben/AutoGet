# 🗄️ Guide Complet de Configuration Supabase

## ✅ Tout est configuré pour Supabase!

Votre application est maintenant configurée pour utiliser Supabase au lieu de localStorage.

## 🚀 ÉTAPE 1: Créer les tables dans Supabase

1. **Allez sur votre Dashboard Supabase**: https://supabase.com/dashboard/project/nyehvkzhflxrewllwjzv
2. **Allez dans l'onglet "SQL Editor"** (éditeur SQL)
3. **Copiez TOUT le contenu** du fichier `supabase-schema-complet.sql`
4. **Collez** dans l'éditeur SQL
5. **Cliquez sur "Run"** (Exécuter)

Le script va créer toutes ces tables:
- ✅ `fournisseurs` - Fournisseurs
- ✅ `produits` - Produits
- ✅ `variantes` - Variantes de produits
- ✅ `entrees` - Entrées de stock
- ✅ `entree_lignes` - Lignes d'entrée
- ✅ `paiements` - Paiements aux fournisseurs
- ✅ `depenses` - Dépenses quotidiennes

## 🔐 RLS (Row Level Security)

Le script **désactive automatiquement** RLS pour que tout fonctionne immédiatement.

Si vous voulez plus de sécurité plus tard, vous pouvez activer RLS et créer des politiques.

## ✅ ÉTAPE 2: Vérifier que c'est activé

Dans votre application (`src/config.js`), la ligne est:
```javascript
export const USE_SUPABASE = true;
```

C'est **DÉJÀ** configuré! ✅

## 🎉 C'est prêt!

Dès que vous aurez exécuté le SQL dans Supabase:
- ✅ Toutes les données seront sauvegardées dans Supabase
- ✅ Accessible de partout (pas seulement un navigateur)
- ✅ Backup automatique
- ✅ Historique des modifications
- ✅ Fonctionne avec tous les utilisateurs

## 📊 Vérifier les tables créées

1. Allez dans Supabase Dashboard
2. Cliquez sur "Table Editor"
3. Vous devriez voir toutes les tables créées

## 🆘 Si vous avez des erreurs

### Erreur: "relation does not exist"
→ Vous n'avez pas exécuté le script SQL. Exécutez `supabase-schema-complet.sql`

### Erreur: "permission denied"
→ RLS est activé. Vérifiez que le script a bien désactivé RLS (regardez ligne 87-93 du SQL)

### Application ne charge pas de données
→ Vérifiez que USE_SUPABASE est à `true` dans `src/config.js`

## 📝 Commandes utiles

### Aller sur votre dashboard Supabase:
https://supabase.com/dashboard/project/nyehvkzhflxrewllwjzv

### Voir les données:
Dashboard Supabase > Table Editor > Sélectionnez une table

### Modifier les données:
Dashboard Supabase > Table Editor > Double-cliquez sur une cellule

## 🎯 Résumé

**Étape 1:** Exécuter `supabase-schema-complet.sql` dans Supabase SQL Editor  
**Étape 2:** Tout est déjà configuré dans le code!  
**Étape 3:** Utiliser l'application normalement

---

**Vos données sont maintenant dans Supabase! 🎉**

