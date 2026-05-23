# 📘 Guide d'Utilisation - AppHeader

## Vue d'ensemble

`AppHeader` est un composant de navigation moderne et responsive utilisant **shadcn/ui** et **lucide-react** pour remplacer l'ancienne barre de navigation.

## Fichiers modifiés/créés

- ✅ `src/components/AppHeader.jsx` - Nouveau composant header
- ✅ `src/App.jsx` - Intégration d'AppHeader, suppression de Navigation et SupabaseHealthBar
- ⚠️ `src/components/Navigation.jsx` - Conservé mais non utilisé (peut être supprimé)

## Props attendues

Le composant `AppHeader` attend les props suivantes :

```jsx
<AppHeader
  activeView={string}           // ID de la vue active ('dashboard', 'products', etc.)
  setActiveView={function}       // Fonction pour changer la vue active
  user={object}                 // Objet utilisateur { name: string, ... }
  logout={function}             // Fonction de déconnexion
  isAdmin={function}            // Fonction retournant boolean (true si admin)
  isUser={function}             // Fonction retournant boolean (true si user)
/>
```

## Fonctionnalités

### ✅ Navigation Desktop (≥ md)
- 5 premiers items visibles directement
- 2 derniers items dans un menu "Plus" (DropdownMenu)
- Boutons avec icônes lucide-react
- Indicateur visuel pour la vue active

### ✅ Navigation Mobile (< md)
- Bouton hamburger qui ouvre un Sheet latéral
- Tous les items de navigation visibles
- Informations utilisateur et badge rôle
- Bouton déconnexion intégré

### ✅ Indicateurs et badges
- **Badge rôle**: Affiche "Administrateur" si `isAdmin()` retourne true
- **Statut Supabase**: Pill discret montrant le statut de connexion et le nombre de produits (desktop seulement, caché sur mobile pour économiser l'espace)
- **Statut LocalStorage**: Si Supabase n'est pas activé, affiche "LocalStorage"

### ✅ Icônes utilisées
- `LayoutDashboard` - Tableau de Bord
- `Package` - Produits
- `ArrowDownLeft` - Entrées de Stock
- `Building2` - Fournisseurs
- `PiggyBank` - Dépenses
- `Boxes` - Colis Envoyés
- `Users` - Salariés

## Gestion de l'overflow

Sur desktop, si l'espace est limité :
- Les **5 premiers items** sont affichés directement
- Les **2 derniers items** (Colis Envoyés, Salariés) sont dans un menu "Plus"

Pour ajuster cette logique, modifiez la fonction `getVisibleItems()` dans `AppHeader.jsx` :

```jsx
const primary = navItems.slice(0, 5);  // Nombre d'items visibles
const overflow = navItems.slice(5);    // Items dans "Plus"
```

## Intégration dans App.jsx

### Avant :
```jsx
import Navigation from './components/Navigation'
import SupabaseHealthBar from './components/SupabaseHealthBar'

// ...
<SupabaseHealthBar />
<Navigation ... />
```

### Après :
```jsx
import AppHeader from './components/AppHeader'

// ...
<AppHeader
  activeView={activeView}
  setActiveView={setActiveView}
  user={user}
  logout={logout}
  isAdmin={isAdmin}
  isUser={isUser}
/>
```

## Récupération du count de produits

Le composant utilise `useData()` pour récupérer le nombre de produits :

```jsx
const dataCtx = useData();
const produitsCount = USE_SUPABASE 
  ? (dataCtx?.produits?.length ?? 0)
  : (dataCtx?.state?.produits?.length ?? 0);
```

Le statut Supabase se met à jour automatiquement lorsque `produitsCount` change.

## Accessibilité

- ✅ `aria-label` sur les boutons de navigation
- ✅ Focus states visibles (via shadcn/ui)
- ✅ Navigation clavier supportée (Tab/Shift+Tab/Enter)
- ✅ Screen reader friendly (`sr-only` pour le bouton hamburger)

## Styles

Le header utilise :
- **Position sticky** : Reste visible en haut lors du scroll
- **Backdrop blur** : Effet de flou moderne
- **Border bottom** : Séparation subtile avec le contenu
- **Hauteur fixe** : `h-14` (3.5rem / 56px)

## Personnalisation

### Changer les icônes

Modifiez le tableau `navItems` dans `AppHeader.jsx` :

```jsx
const navItems = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  // ...
];
```

### Ajouter/Retirer des items

Ajoutez ou retirez des objets dans `navItems`. Assurez-vous que les IDs correspondent aux cases dans `App.jsx` → `renderView()`.

### Modifier les couleurs

Les couleurs respectent le thème shadcn/ui. Modifiez `tailwind.config.js` si nécessaire pour personnaliser les couleurs de base.

## Tests recommandés

1. ✅ Redimensionner la fenêtre et vérifier que rien ne sort de l'écran
2. ✅ Tester la navigation au clavier (Tab, Enter, Escape)
3. ✅ Vérifier que le badge "Administrateur" s'affiche pour les admins
4. ✅ Vérifier que le statut Supabase se met à jour
5. ✅ Tester le menu mobile (Sheet)
6. ✅ Vérifier que le menu "Plus" fonctionne sur desktop
7. ✅ Tester le bouton de déconnexion (desktop et mobile)

