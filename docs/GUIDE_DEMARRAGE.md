# 🚀 Guide de Démarrage Rapide

## 📊 État Actuel

Votre application est maintenant **prête à être utilisée** avec deux options de stockage:

### ✅ Option 1: LocalStorage (Actuellement Active)
- **Avantage**: Fonctionne immédiatement sans configuration
- **Inconvénient**: Données limitées au navigateur actuel
- **Utilisation**: Déjà fonctionnelle!

### ✅ Option 2: Supabase (Disponible)
- **Avantage**: Base de données cloud, accessible de partout, backup automatique
- **Inconvénient**: Nécessite une configuration
- **Utilisation**: Suivez les étapes ci-dessous

---

## 🎯 Pour Démarrer Maintenant (LocalStorage)

L'application fonctionne **immédiatement** avec localStorage:

```bash
npm run dev
```

Ouvrez http://localhost:5173 dans votre navigateur et commencez à l'utiliser!

---

## 🔗 Pour Activer Supabase

Si vous souhaitez utiliser Supabase au lieu de localStorage:

### Étape 1: Créer les tables dans Supabase

1. Connectez-vous à https://supabase.com/dashboard/project/nyehvkzhflxrewllwjzv
2. Allez dans **SQL Editor**
3. Copiez tout le contenu du fichier `supabase-schema.sql`
4. Collez dans l'éditeur et cliquez sur **Run**

### Étape 2: Désactiver RLS (Row Level Security)

Dans SQL Editor, exécutez:

```sql
ALTER TABLE fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE variantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE entrees DISABLE ROW LEVEL SECURITY;
ALTER TABLE entree_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE paiements DISABLE ROW LEVEL SECURITY;
```

### Étape 3: Activer Supabase dans l'application

Éditez le fichier `src/config.js` et changez:

```javascript
export const USE_SUPABASE = true; // Au lieu de false
```

### Étape 4: Redémarrer l'application

```bash
npm run dev
```

---

## 📁 Fichiers Créés

### Configuration
- ✅ `src/config/supabase.js` - Configuration Supabase
- ✅ `src/config.js` - Sélection localStorage/Supabase
- ✅ `supabase-schema.sql` - Script SQL pour créer les tables

### Context Providers
- ✅ `src/context/DataContext.jsx` - Provider localStorage
- ✅ `src/context/DataContextSupabase.jsx` - Provider Supabase

### Composants
- ✅ `src/components/Dashboard.jsx` - Tableau de bord
- ✅ `src/components/Products.jsx` - Gestion produits
- ✅ `src/components/Entries.jsx` - Gestion entrées
- ✅ `src/components/Suppliers.jsx` - Gestion fournisseurs
- ✅ `src/components/Navigation.jsx` - Navigation

### Documentation
- ✅ `README.md` - Documentation complète
- ✅ `INSTRUCTIONS_SUPABASE.md` - Instructions détaillées Supabase
- ✅ `GUIDE_DEMARRAGE.md` - Ce fichier

---

## 🎨 Fonctionnalités Complètes

### ✅ Gestion des Produits
- Créer/modifier/supprimer des produits
- Ajouter plusieurs variantes (taille, couleur, modèle)
- Suivi des quantités par variante

### ✅ Entrées de Stock
- Enregistrer les entrées de marchandise
- Sélectionner produit, variante, quantité
- Associer un fournisseur
- Mise à jour automatique du stock
- Calcul automatique des valeurs

### ✅ Tableau de Bord
- Valeur totale du stock
- Montants dus aux fournisseurs
- Montants payés
- Nombre total d'entrées
- Historique détaillé

### ✅ Gestion Fournisseurs & Paiements
- Liste des fournisseurs avec montants dus
- Enregistrer les paiements
- Historique des paiements
- Marquage automatique des entrées payées
- Calcul des soldes

### ✅ Fonctionnalités Supplémentaires
- Export des données en JSON
- Design moderne et responsive
- Navigation intuitive
- Sauvegarde automatique

---

## 🔧 Commandes Disponibles

```bash
# Lancer en développement
npm run dev

# Build pour production
npm run build

# Prévisualiser le build
npm run preview

# Linter
npm run lint
```

---

## 📊 Structure des Données

### Avec LocalStorage
Les données sont stockées dans le navigateur avec la structure:
```json
{
  "produits": [...],
  "fournisseurs": [...],
  "entrees": [...],
  "paiements": [...]
}
```

### Avec Supabase
Les données sont stockées dans Supabase avec 6 tables:
- `fournisseurs`
- `produits`
- `variantes`
- `entrees`
- `entree_lignes`
- `paiements`

---

## 💡 Conseils d'Utilisation

### Pour commencer
1. Lancez `npm run dev`
2. Allez dans l'onglet **Fournisseurs** et ajoutez un fournisseur
3. Allez dans l'onglet **Produits** et ajoutez un produit
4. Ajoutez des variantes au produit
5. Allez dans **Entrées** et enregistrez une entrée de stock

### Organisation
- Les variantes permettent de gérer différentes tailles/couleurs du même modèle
- Les entrées augmentent automatiquement les quantités en stock
- Les paiements réduisent les montants dus
- Le tableau de bord vous donne une vue d'ensemble

### Export
- Utilisez le bouton **"📥 Exporter les Données"** dans le tableau de bord pour sauvegarder vos données

---

## ⚠️ Notes Importantes

1. **LocalStorage**: Les données sont spécifiques au navigateur. Pour changer de navigateur, utilisez l'export.

2. **Supabase**: Les données sont accessibles de n'importe où. Plus besoin d'exports manuels.

3. **Migration**: Vous ne pouvez pas migrer automatiquement de localStorage vers Supabase. Exportez d'abord vos données localStorage, puis réimportez-les manuellement.

4. **Sécurité**: Les clés API Supabase utilisées sont publiques et anonymes. Pour la production, considérez l'ajout de l'authentification.

---

## 🆘 Dépannage

### L'application ne se lance pas
```bash
# Supprimez node_modules et réinstallez
rm -rf node_modules package-lock.json
npm install --cache /tmp/npm-cache
```

### Erreur Supabase "relation does not exist"
→ Vous n'avez pas exécuté le script SQL. Allez dans Supabase SQL Editor et exécutez `supabase-schema.sql`

### Erreur Supabase RLS policy violation
→ Désactivez RLS ou créez des politiques appropriées (voir `INSTRUCTIONS_SUPABASE.md`)

### Les données disparaissent
→ Avec localStorage, les données sont dans le navigateur. Changez de navigateur → les données disparaissent.
→ Avec Supabase, les données sont dans le cloud.

---

## 📞 Support

Si vous rencontrez des problèmes:
1. Vérifiez la console du navigateur (F12)
2. Consultez les logs dans Supabase Dashboard
3. Vérifiez les fichiers de documentation
4. Relisez ce guide

---

## ✨ Prochaines Étapes

1. ✅ Testez l'application avec localStorage
2. 🔧 Configurez Supabase si vous le souhaitez
3. 🎨 Personnalisez le design selon vos besoins
4. 📊 Ajoutez des statistiques supplémentaires si nécessaire
5. 🔐 Ajoutez l'authentification pour la production

**Bonne utilisation! 🚀**

