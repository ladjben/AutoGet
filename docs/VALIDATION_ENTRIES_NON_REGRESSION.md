# Validation non-régression — Redesign `Entries.jsx`

**Date :** 2026-08-01  
**Base de comparaison :** `HEAD` (working tree vs parent local, branche `main`)  
**Fichier audité :** `src/components/Entries.jsx`  
**Périmètre :** présentation UI uniquement — aucune correction appliquée (aucune régression métier détectée).  
**Combobox produit de référence :** commit `bb3ac6d` (`feat: add product search to stock entry form`)

---

## Méthode

1. Extraction et comparaison whitespace-insensible des fonctions métier (`createEntree`, `handleAddEntree`, `handleDeleteEntree`, `calculateStats`, filtres, helpers prix, combobox, etc.).
2. Contrôle des chaînes de payload / toasts / confirm / appels Supabase.
3. Inventaire des deltas purement présentationnels (`toggleLignes`, badges, table/cartes, récap formulaire).
4. Build + ESLint.

**Verdict global :** aucune régression métier introduite. Diff = UI + helpers de rendu. **Pas de commit** dans ce lot.

---

## Matrice de non-régression

| # | Comportement | Emplacement avant | Emplacement après | Résultat | Différence | Risque |
|---|--------------|-------------------|-------------------|----------|------------|--------|
| 1.1 | Validations création (fournisseur + ≥1 ligne) | `handleAddEntree` | `handleAddEntree` | **OK** | Identique (toast destructif inchangé) | Aucun |
| 1.2 | Validation ligne (produit + quantité) | `handleAddLigne` | `handleAddLigne` | **OK** | Identique | Aucun |
| 1.3 | Format date formulaire (`YYYY-MM-DD` via `input type=date`) | champ `formData.date` | idem | **OK** | Identique | Aucun |
| 1.4 | Fournisseur (`formData.fournisseurId`) | select formulaire | select section « Date et fournisseur » | **OK** | UI seulement | Aucun |
| 1.5 | Structure `lignes` `{ produitId, quantite }` | `handleAddLigne` | `handleAddLigne` | **OK** | Identique | Aucun |
| 1.6 | Mapping Supabase `produit_id` / `variante_id: null` / `quantite` | `createEntree` | `createEntree` | **OK** | Bloc payload **identique** | Aucun |
| 1.7 | `produitId` = `p.id` à la sélection | `CommandItem.onSelect` | `productCombobox` / même `onSelect` | **OK** | Combobox `bb3ac6d` conservé | Aucun |
| 1.8 | Quantité `parseInt(..., 10)` | `handleAddLigne` | `handleAddLigne` | **OK** | Identique | Aucun |
| 1.9 | `paye: false` (Supabase + local) | `createEntree` (×2) | `createEntree` (×2) | **OK** | Compteur `paye: false` = 2 / 2 | Aucun |
| 1.10 | `created_by` | — | — | **N/A** | Absent avant et après (non géré dans ce composant) | Aucun |
| 1.11 | Appel Supabase `addEntreeWithLines(payload)` | `createEntree` | `createEntree` | **OK** | Identique | Aucun |
| 1.12 | Appel local `dispatch(ADD_ENTREE)` | `createEntree` | `createEntree` | **OK** | Identique | Aucun |
| 2.1 | Combobox `Popover`+`Command` (`shouldFilter={false}`) | formulaire | `productCombobox` | **OK** | Apparence (classes) uniquement | Aucun |
| 2.2 | Recherche nom + référence (trim, case-insensitive) | `filteredProduitsForPicker` | `filteredProduitsForPicker` | **OK** | Identique | Aucun |
| 2.3 | Prix `prix_achat ?? prixAchat` | items + trigger | idem | **OK** | Identique | Aucun |
| 2.4 | Produit sélectionné conservé si recherche effacée | `setProduitSearch('')` sans toucher `produitId` | idem | **OK** | Identique | Aucun |
| 2.5 | États recherche indépendants entre lignes | reset à l’ajout / fermeture | idem (`handleAddLigne`, `resetForm`) | **OK** | Identique | Aucun |
| 2.6 | Empty state « Aucun produit trouvé » | `CommandEmpty` | `CommandEmpty` | **OK** | Identique | Aucun |
| 3.1 | Appel `findEnvoiDoublon(fournisseurId, lignesDoublon)` | `handleAddEntree` | `handleAddEntree` | **OK** | Identique | Aucun |
| 3.2 | Paramètres doublon `{ produit_id, quantite }` | `lignesDoublon` | `lignesDoublon` | **OK** | Identique | Aucun |
| 3.3 | Condition `USE_SUPABASE && dataCtx?.findEnvoiDoublon` | `handleAddEntree` | `handleAddEntree` | **OK** | Identique | Aucun |
| 3.4 | Blocage UI + confirmation « Créer quand même » | alerte + `handleConfirmDespiteDoublon` | alerte `role=alert` + même handler | **OK** | Style plus visible uniquement | Aucun |
| 3.5 | Aucun contournement doublon | footer masqué si `doublonAlert` | idem | **OK** | Identique | Aucun |
| 4.1 | Valeur ligne local `qté × getProduitPrixAchat` | cartes détail + `calculateEntreeValueLocal` | table détail + même helper | **OK** | Formules identiques | Aucun |
| 4.2 | Total formulaire (récap) | — (non affiché) | `formLignesMontant` / `formLignesQte` | **OK** | **Ajout présentation** : même formule `qté × getProduitPrixAchat` | Aucun |
| 4.3 | Stats globales (`calculateStats` / `globalStats`) | `useMemo` admin | idem | **OK** | Identique | Aucun |
| 4.4 | Valeurs payé / non payé (`totalValuePayees` / `NonPayees`) | résumé admin | KPI + meta | **OK** | Identique | Aucun |
| 4.5 | Périodes `filterByPeriod` today/week/month | `periodStats` | `periodStats` | **OK** | Identique | Aucun |
| 4.6 | Arrondi affichage `toFixed(2)` + `toLocaleString('fr-FR')` | `formatDa` | `formatDa` (module) | **OK** | Formule **identique**, scope déplacé | Aucun |
| 5.1 | Liste = `filteredEntrees` | map Cards | table + cartes | **OK** | Même source de données | Aucun |
| 5.2 | Filtres fournisseur + plage dates | `filteredEntrees` + state `filters` | idem | **OK** | Identique | Aucun |
| 5.3 | Champ « recherche texte » liste | absent | absent | **OK** | Pas de recherche liste avant/après (filtres seulement) | Aucun |
| 5.4 | Chargement détails Supabase `fetchEntreeDetails` | `showDetails` | `showDetails` (+ `toggleLignes` délègue) | **OK** | Corps `showDetails` **identique** | Aucun |
| 5.5 | Fallback `fournisseur_id ?? fournisseurId` | liste | liste | **OK** | Identique | Aucun |
| 5.6 | Fallback prix détail SB `produit_id?.prix_achat ?? 0` | cartes | table lignes | **OK** | Identique | Aucun |
| 5.7 | Identifiants actions = `entree.id` | delete / details | idem | **OK** | Affichage tronqué `#slice(0,8)` — id complet toujours utilisé pour actions | Faible |
| 5.8 | Lignes local toujours visibles | toujours dans chaque Card | mobile : `alwaysLocal` ; desktop : via « Voir lignes » | **OK présentation** | Desktop local : détail derrière action (accessible, non détruit) | Faible |
| 5.9 | Affichage `statut` (`en_attente` / `valide` / `litige`) | non affiché | `StatusBadge` si `entree.statut` | **OK** | **Ajout lecture seule** du champ existant — aucune mutation | Aucun |
| 6.1 | Gate `isAdmin()` stats | 2 blocs Card | KPI + périodes | **OK** | Même contrôle | Aucun |
| 6.2 | Suppression entrée admin only | bouton Card | menus desktop/mobile | **OK** | Même `isAdmin()` ; 2 emplacements layout | Aucun |
| 6.3 | `window.confirm('Êtes-vous sûr…')` | `handleDeleteEntree` | `handleDeleteEntree` | **OK** | Texte identique | Aucun |
| 6.4 | Delete Supabase `.from('entrees').delete().eq('id', …)` | `handleDeleteEntree` | `handleDeleteEntree` | **OK** | Identique | Aucun |
| 6.5 | Delete local `DELETE_ENTREE` | `handleDeleteEntree` | `handleDeleteEntree` | **OK** | Identique | Aucun |
| 6.6 | Toasts succès/erreur | handlers | handlers | **OK** | Messages identiques | Aucun |
| 6.7 | Retrait ligne formulaire admin only | `handleDeleteLigne` + `isAdmin` | idem | **OK** | Identique | Aucun |
| 6.8 | Aucune action non autorisée ajoutée | — | — | **OK** | Pas de nouveau bouton métier hors gates existantes | Aucun |
| 7.1 | Statuts métier `en_attente` / `valide` / `litige` | non écrits par ce composant | non écrits ; badge lecture | **OK** | Création ne pose toujours pas `statut` ici (serveur / ailleurs) | Aucun |
| 7.2 | Payé / non payé (`Boolean(entree.paye)`) | Badge | `StatusBadge` | **OK** | Même booléen ; labels Payé / Non payé | Aucun |
| 7.3 | Aucune entrée réelle enregistrée pendant tests UI | — | — | **OK** | Dialogues annulés / fermés sans `createEntree` | Aucun |

---

## Deltas présentationnels (non métier)

| Delta | Impact |
|-------|--------|
| `DialogTrigger` → ouverture via `setShowModal(true)` | Même state `showModal` / `resetForm` à la fermeture |
| `toggleLignes` | UX : « Voir lignes » aussi en local ; Supabase délègue toujours à `showDetails` |
| Récap quantités/montant dans le dialog | Affichage dérivé des lignes locales, formules inchangées |
| Table desktop + cartes mobile | Remplace les Cards empilées |
| Affichage date `formatDateFr` en liste | Format FR ; valeur source `entree.date` inchangée |
| Badge `statut` | Lecture seule si présent sur l’objet |

**Aucune correction de code effectuée** : aucun de ces deltas n’altère payload, calculs, requêtes, permissions ou détection de doublons.

---

## Contrôles automatiques

| Contrôle | Résultat |
|----------|----------|
| Build (`npm run build`) | OK |
| ESLint `Entries.jsx` | 0 erreur |
| Warning Hooks `calculateEntreeValueLocal` | **Préexistant** — non corrigé |
| Nouveaux problèmes ESLint | Aucun |
| Appels / conditions métier modifiés dans le diff | **Aucun** (fonctions listées **WHITESPACE-IDENTICAL**) |
| Données temporaires persistées | **Aucune** (pas d’enregistrement pendant les tests) |

---

## Synthèse

- **Création, doublons, calculs, filtres, suppression, dual-path, combobox `bb3ac6d` :** non-régression confirmée.  
- **Risques résiduels :** faibles et purement UX (troncature visuelle de l’UUID, détail local desktop derrière « Voir lignes »).  
- **Prêt pour commit** après validation utilisateur — **commit non créé** dans cet audit.
