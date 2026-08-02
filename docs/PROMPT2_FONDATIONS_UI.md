# Prompt 2 — Fondations visuelles (lot livré)

**Date :** 2026-08-01  
**Scope :** design system + navigation + composants partagés uniquement.  
**Hors scope :** pages métier, auth, SQL, calculs, cycle `en_attente→valide/litige`, risques R1–R14.

## Livré

### Design system
- Tokens CSS (`src/index.css`) : encre sombre + accent **laiton/ambre** (remplace le bleu primaire générique)
- Typo : **DM Sans** (UI) + **Syne** (titres / marque) via Google Fonts
- `tailwind.config.js` : `fontFamily.sans` / `fontFamily.display`
- `index.html` : `lang="fr"`, classe `dark`, polices

### Navigation / shell
- `Sidebar.jsx` : labels FR, logo Cosmos, états actifs laiton, sections renommées
- `TopHeader.jsx` : titre de page selon `activeView` ; badge « Admin » **volontairement inchangé** (R12)
- `App.jsx` : enveloppe `PageSurface` autour du contenu

### Composants partagés (nouveaux, non branchés sur les pages métier)
- `PageHeader.jsx` — en-tête titre / description / actions
- `PageSurface.jsx` — fond atmosphérique léger
- `StatusBadge.jsx` — badges présentationnels en_attente / valide / litige

## Non touché (volontaire)
- Login / Signup (auth)
- Dashboard, Products, Entries, Suppliers, Salaries, etc.
- Logique `paye`, validations, Supabase, SQL
- Risques R1–R14

## Validation demandée
1. Recharger l’app connectée : sidebar + header + teinte primaire
2. Vérifier checklist rôles (`docs/CHECKLIST_ROLES_REFERENCE.md`) smoke navigation
3. Confirmer avant redesign des pages métier
