# Instructions pour configurer Supabase

## 📋 Étapes d'Installation

### 1. Exécuter le script SQL dans Supabase

1. Connectez-vous à votre projet Supabase: https://supabase.com/dashboard/project/nyehvkzhflxrewllwjzv
2. Allez dans l'onglet **SQL Editor**
3. Copiez le contenu du fichier `supabase-schema.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **Run** pour exécuter le script

Le script va créer toutes les tables nécessaires:
- `fournisseurs` - Table des fournisseurs
- `produits` - Table des produits (chaussures)
- `variantes` - Table des variantes (taille, couleur, modèle)
- `entrees` - Table des entrées de stock
- `entree_lignes` - Détails des lignes d'entrée
- `paiements` - Table des paiements

### 2. Vérifier les tables créées

1. Dans Supabase Dashboard, allez dans **Table Editor**
2. Vous devriez voir toutes les tables créées

### 3. Activer les politiques RLS (Row Level Security)

Par défaut, Supabase active RLS mais bloque toutes les opérations. Vous devez créer des politiques pour permettre les opérations.

**Option A: Désactiver RLS temporairement (pour le développement)**

Dans SQL Editor, exécutez:
```sql
ALTER TABLE fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE variantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE entrees DISABLE ROW LEVEL SECURITY;
ALTER TABLE entree_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE paiements DISABLE ROW LEVEL SECURITY;
```

**Option B: Créer des politiques appropriées (recommandé pour la production)**

```sql
-- Politiques pour fournisseurs
CREATE POLICY "Allow all operations on fournisseurs" ON fournisseurs
  FOR ALL USING (true) WITH CHECK (true);

-- Politiques pour produits
CREATE POLICY "Allow all operations on produits" ON produits
  FOR ALL USING (true) WITH CHECK (true);

-- Politiques pour variantes
CREATE POLICY "Allow all operations on variantes" ON variantes
  FOR ALL USING (true) WITH CHECK (true);

-- Politiques pour entrees
CREATE POLICY "Allow all operations on entrees" ON entrees
  FOR ALL USING (true) WITH CHECK (true);

-- Politiques pour entree_lignes
CREATE POLICY "Allow all operations on entree_lignes" ON entree_lignes
  FOR ALL USING (true) WITH CHECK (true);

-- Politiques pour paiements
CREATE POLICY "Allow all operations on paiements" ON paiements
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. Utiliser le nouveau DataContext

Pour utiliser Supabase au lieu de localStorage, remplacez l'import dans `App.jsx`:

**Option 1: Utiliser localStorage (par défaut)**
```jsx
import { DataProvider } from './context/DataContext';
```

**Option 2: Utiliser Supabase**
```jsx
import { DataProvider } from './context/DataContextSupabase';
```

Puis dans `src/App.jsx`, remplacez simplement l'import.

### 5. Lancer l'application

```bash
npm run dev
```

## 🔧 Structure des Tables

### Table `fournisseurs`
- `id` - UUID (Primary Key)
- `nom` - TEXT
- `contact` - TEXT
- `adresse` - TEXT
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

### Table `produits`
- `id` - UUID (Primary Key)
- `nom` - TEXT
- `reference` - TEXT
- `prix_achat` - DECIMAL
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

### Table `variantes`
- `id` - UUID (Primary Key)
- `produit_id` - UUID (Foreign Key -> produits)
- `taille` - TEXT
- `couleur` - TEXT
- `modele` - TEXT
- `quantite` - INTEGER
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

### Table `entrees`
- `id` - UUID (Primary Key)
- `date` - DATE
- `fournisseur_id` - UUID (Foreign Key -> fournisseurs)
- `paye` - BOOLEAN
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

### Table `entree_lignes`
- `id` - UUID (Primary Key)
- `entree_id` - UUID (Foreign Key -> entrees)
- `variante_id` - UUID (Foreign Key -> variantes)
- `quantite` - INTEGER
- `created_at` - TIMESTAMP

### Table `paiements`
- `id` - UUID (Primary Key)
- `fournisseur_id` - UUID (Foreign Key -> fournisseurs)
- `montant` - DECIMAL
- `date` - DATE
- `description` - TEXT
- `created_at` - TIMESTAMP

## 🔑 Clés d'API

Votre clé API Supabase est déjà configurée dans `src/config/supabase.js`:
- URL: https://nyehvkzhflxrewllwjzv.supabase.co
- Anon Key: (déjà configuré)

## ⚠️ Notes Importantes

1. **Sécurité**: Les clés API exposées ici sont des clés anonymes publiques. Pour la production, considérez:
   - Utiliser des politiques RLS plus strictes
   - Ajouter l'authentification utilisateur
   - Utiliser des rôles et permissions

2. **Performance**: Pour de grandes quantités de données, considérez:
   - Ajouter plus d'index sur les colonnes fréquemment interrogées
   - Utiliser le cache côté client
   - Implémenter la pagination

3. **Backup**: Les données sont maintenant dans Supabase. Vous pouvez faire des backups depuis le dashboard Supabase.

## 📝 Exemple d'Utilisation

Une fois Supabase configuré et l'application connectée, vous pouvez:

```javascript
// Dans vos composants
const { state, supabase, loadAllData } = useData();

// Les données sont automatiquement chargées depuis Supabase
// Tous les changements sont persistés automatiquement
```

## 🐛 Dépannage

Si vous rencontrez des erreurs:
1. Vérifiez que toutes les tables sont créées
2. Vérifiez que RLS est désactivé ou que les politiques sont configurées
3. Consultez la console du navigateur pour les erreurs
4. Vérifiez les logs Supabase dans le dashboard

