# Checklist de référence — Rôles AutoGet

**Source :** `docs/AUDIT_FONCTIONNEL_UI.md`  
**Usage :** non-régression après chaque lot UI.  
**Risques R1–R14 :** hors scope — ne pas « corriger » pendant les tests UI sauf autorisation explicite.

---

## Admin

### Accès & navigation
- [ ] Login → landing `dashboard`
- [ ] Menu complet : Dashboard, Products, Inventory, Entrées validées, Suppliers, Dépenses, Colis, Salariés, Réception, Accès & Assignation
- [ ] Badge / zone utilisateur cohérente (ne pas exiger correction R12)
- [ ] Déconnexion fonctionne

### Inventaire
- [ ] CRUD produits (create / edit / **delete**)
- [ ] Créer entrée stock ; filtres ; stats
- [ ] Voir entrées validées / litige ; éditer qté reçue

### Fournisseurs
- [ ] Liste fournisseurs + détail
- [ ] Soft-delete / restore fournisseur
- [ ] Ajouter / supprimer paiement
- [ ] Accès & Assignation : assigner produit, créer compte fournisseur/employé

### Flux réception
- [ ] Ouvrir Réception ; valider envoi → `valide` ou `litige`
- [ ] Notification manque créée si qté < envoyée (**ne pas** changer la logique)

### Opérations
- [ ] Dépenses + catégories
- [ ] Colis CRUD
- [ ] Salariés : acomptes, actions rapides, clôture (acomptes conservés), fiche multi-mois

### Interdit de casser
- Cycle `en_attente → valide|litige`
- Formules reste / montants (écarts portail connus R1/R2 : **constater seulement**)
- Champ `paye` inchangé

---

## User

### Accès & navigation
- [ ] Login → landing `dashboard`
- [ ] Même menu large que l’admin (comportement actuel documenté)
- [ ] **Pas** de boutons supprimer (produits, entrées, salaires…)
- [ ] Hard gate : Fournisseurs / Accès & Assignation / Entrées validées → « Accès restreint »

### Capacités attendues
- [ ] Créer / éditer produits (sans delete)
- [ ] Créer entrées, dépenses, colis, acomptes (selon UI existante)
- [ ] Portail / Réception accessibles via nav (pas de hard gate interne actuel)

### Interdit de casser
- Différence admin vs user sur suppressions et hard gates

---

## Fournisseur

### Accès & navigation
- [ ] Login → landing `supplier-portal` uniquement
- [ ] Nav limitée à « Mon espace »
- [ ] Sans `fournisseur_id` → message compte non configuré

### Parcours métier
- [ ] Overview (stats vue dashboard)
- [ ] Créer envoi (produits assignés seulement) → statut `en_attente`
- [ ] Consulter mes envois (attente / validés)
- [ ] Voir notifications manques ; marquer lue

### Interdit de casser
- Catalogue limité aux assignations
- Création envoi `en_attente` + `paye:false`
- Ne pas « aligner » `montant_du` sur l’admin (R1/R2)

---

## Employe

### Accès & navigation
- [ ] Login → landing `employee-validation`
- [ ] Nav limitée à « Valider la marchandise »

### Parcours métier
- [ ] Liste des envois `en_attente`
- [ ] Ouvrir détail ; qté reçue préremplie = envoyée
- [ ] Confirmer égalité → `valide`
- [ ] Confirmer manque → `litige` + notification

### Interdit de casser
- Logique de statut et création notification
- Pas de redesign du flux de validation dans ce lot fondations

---

## Smoke commun (tous rôles)

- [ ] Build `npm run build` OK
- [ ] Shell (sidebar + header) s’affiche sans erreur
- [ ] Toasts / dialogs shadcn toujours utilisables
- [ ] Impression fiche de paie (admin/user sur Salariés) non régressée
