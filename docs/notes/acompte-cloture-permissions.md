# Note — permissions clôture mensuelle (acomptes)

**Constat (lot journal acomptes, 2026-08) :**  
Les boutons « Clôturer le mois » et « Annuler la clôture » dans `Salaries.jsx` sont visibles pour tout rôle ayant accès à la vue Salariés (`admin` et `user`), pas seulement `admin`.

Ce lot **ne change pas** ces droits. Un durcissement éventuel (admin-only) est à traiter séparément.
