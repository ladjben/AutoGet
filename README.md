# Application de Gestion de Marchandise pour Chaussures

Une application web complète pour gérer les stocks, les fournisseurs et les paiements pour la vente de chaussures.

## 🎯 Fonctionnalités

### 1. Gestion des Produits
- ✅ Créer des produits chaussure avec nom, référence, et prix d'achat unitaire
- ✅ Ajouter des variantes pour chaque produit (taille, couleur, modèle)
- ✅ Gérer les quantités en stock par variante
- ✅ Éditer et supprimer des produits et variantes

### 2. Gestion des Entrées de Stock
- ✅ Enregistrer les entrées de marchandise
- ✅ Sélectionner le produit et les variantes
- ✅ Indiquer les quantités reçues
- ✅ Associer à un fournisseur
- ✅ Date automatique
- ✅ Calcul automatique des valeurs (quantité × prix d'achat)
- ✅ Mise à jour automatique du stock

### 3. Tableau de Bord
- ✅ Vue d'ensemble avec tous les produits et variantes
- ✅ Quantité actuelle en stock par variante
- ✅ Prix d'achat unitaire
- ✅ Valeur totale du stock par variante
- ✅ Valeur totale de TOUT le stock (somme de tout)
- ✅ Historique des entrées avec dates et fournisseurs
- ✅ Statistiques globales (valeur stock, montants dus, etc.)

### 4. Gestion des Fournisseurs et Paiements
- ✅ Liste des fournisseurs avec montant total DÛ
- ✅ Enregistrer les paiements aux fournisseurs
- ✅ Historique des paiements (date, montant, fournisseur)
- ✅ Marquer les entrées comme payées
- ✅ Voir le solde restant dû par fournisseur
- ✅ Calcul automatique des totaux dus et payés

### 5. Fonctionnalités Automatiques
- ✅ Calcul de la valeur totale du stock = Σ(quantité variante × prix d'achat)
- ✅ Calcul du total dû aux fournisseurs = Σ(entrées non payées)
- ✅ Mise à jour automatique des quantités de stock lors des entrées
- ✅ Export des données en JSON

## 🛠️ Technologies Utilisées

- **Frontend**: React 19.1.1 avec Vite
- **Styling**: Tailwind CSS
- **État**: useReducer + Context API
- **Stockage**: localStorage pour la persistance des données
- **Format**: JSON

## 🚀 Installation et Lancement

### Prérequis
- Node.js et npm installés

### Installation
```bash
npm install
```

### Lancement en développement
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### Build pour production
```bash
npm run build
```

Les fichiers de production seront dans le dossier `dist/`

## 📁 Structure du Projet

```
src/
├── components/
│   ├── Dashboard.jsx       # Tableau de bord principal
│   ├── Products.jsx         # Gestion des produits
│   ├── Entries.jsx          # Gestion des entrées
│   ├── Suppliers.jsx        # Gestion des fournisseurs et paiements
│   └── Navigation.jsx       # Navigation entre les vues
├── context/
│   └── DataContext.jsx      # Context API pour la gestion d'état
├── App.jsx                  # Composant principal
├── main.jsx                 # Point d'entrée
└── index.css                # Styles Tailwind

```

## 📊 Structure de Données

Les données sont stockées dans le localStorage avec la structure suivante:

```json
{
  "produits": [
    {
      "id": "prod_1",
      "nom": "Nike Air Max",
      "reference": "REF001",
      "prixAchat": 45,
      "variantes": [
        {
          "id": "var_1",
          "taille": "40",
          "couleur": "noir",
          "modele": "homme",
          "quantite": 10
        }
      ]
    }
  ],
  "fournisseurs": [
    {
      "id": "fourn_1",
      "nom": "Distributeur ABC",
      "contact": "+33123456789",
      "adresse": "123 Rue Example"
    }
  ],
  "entrees": [
    {
      "id": "entree_1",
      "date": "2025-10-27",
      "fournisseurId": "fourn_1",
      "lignes": [
        {
          "varianteId": "var_1",
          "quantite": 10
        }
      ],
      "paye": false
    }
  ],
  "paiements": [
    {
      "id": "paiement_1",
      "fournisseurId": "fourn_1",
      "montant": 450,
      "date": "2025-10-27",
      "description": "Paiement partiel"
    }
  ]
}
```

## 🎨 Interface

L'application propose une interface moderne et responsive avec:
- Design clair et fonctionnel
- Formulaires intuitifs
- Tableaux avec données organisées
- Boutons d'action (éditer, supprimer)
- Modales pour les formulaires
- Navigation entre les différentes vues
- Cards colorées pour les statistiques

## 📝 Utilisation

1. **Ajouter un Fournisseur**: Allez dans l'onglet Fournisseurs et cliquez sur "+ Nouveau Fournisseur"

2. **Ajouter un Produit**: 
   - Allez dans l'onglet Produits
   - Cliquez sur "+ Nouveau Produit"
   - Entrez les informations du produit
   - Ajoutez des variantes (tailles, couleurs, modèles)

3. **Enregistrer une Entrée**:
   - Allez dans l'onglet Entrées de Stock
   - Cliquez sur "+ Nouvelle Entrée"
   - Sélectionnez le fournisseur
   - Ajoutez les lignes (produit, variante, quantité)
   - Le stock est automatiquement mis à jour

4. **Enregistrer un Paiement**:
   - Allez dans l'onglet Fournisseurs
   - Cliquez sur "💰 Nouveau Paiement"
   - Sélectionnez le fournisseur et entrez le montant
   - Les entrées peuvent être marquées automatiquement comme payées

5. **Consulter le Tableau de Bord**:
   - Vue d'ensemble de toutes les statistiques
   - Détail des produits et quantités en stock
   - Historique des entrées
   - Export des données

## 💾 Persistance des Données

Toutes les données sont sauvegardées automatiquement dans le localStorage du navigateur. Pour exporter vos données, utilisez le bouton "📥 Exporter les Données" dans le tableau de bord.

## 🔄 Notes

- Les données sont persistantes entre les sessions
- Le stock est mis à jour automatiquement lors des entrées
- Les calculs (valeur stock, montants dus) sont automatiques
- L'application est responsive et fonctionne sur mobile et desktop

## 📄 Licence

MIT
