# Références visuelles — avant redesign

**Date de capture :** 2026-08-01  
**App :** `http://127.0.0.1:5173` (Vite)  
**Contrainte :** captures de référence uniquement ; pages métier non redesignées dans le lot fondations.

## Captures

| Fichier | Écran | Notes |
|---------|-------|-------|
| `01-login.png` | Connexion | Fond sombre uni, carte centrée, CTA bleu primaire (état pré-tokens laiton) |

## Écrans non capturés (auth requise)

Sans session, les écrans suivants n’ont pas pu être photographiés. Référence structurelle = audit + composants :

| Écran | Composant | Layout actuel (résumé) |
|-------|-----------|------------------------|
| Dashboard | `Dashboard.jsx` | Grilles de cards stats + listes récentes |
| Produits | `Products.jsx` | Liste + dialogs CRUD |
| Entrées | `Entries.jsx` | Formulaire + liste filtrable |
| Entrées validées | `ValidatedEntries.jsx` | Liste admin statut valide/litige |
| Fournisseurs / détail | `Suppliers.jsx`, `SupplierDetail.jsx` | Cards + paiements |
| Dépenses | `Depenses.jsx` | CRUD + catégories |
| Colis | `Colis.jsx` | CRUD + stats |
| Salariés / fiche | `Salaries.jsx`, `SalaryDetail.jsx` | Liste + détail + impression |
| Portail fournisseur | `SupplierPortal.jsx` | Tabs overview / envois / créer / notifs |
| Validation employé | `EmployeeValidation.jsx` | File d’attente + saisie qté |
| Accès & assignation | `SupplierAccess.jsx` | Assignations + création comptes |

**Shell observé (code) :** `Sidebar` (gauche 264px) + `TopHeader` (h-16) + `main` padding 24px.

Pour compléter les captures authentifiées, se connecter manuellement puis déposer les PNG dans ce dossier avec le préfixe `02-`…`12-`.
