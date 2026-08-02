# Risque — Portail fournisseur : chargement bloqué sous React Strict Mode

**Statut :** proposé, **non appliqué**.

- Non inclus dans `feat: redesign supplier portal` (`a0f2f2e`).
- Non inclus dans aucun autre commit du lot redesign.
- Le correctif reste documenté ici uniquement ; **aucune modification de `SupplierPortal.jsx` pour ce risque**.

**Sévérité :** moyenne en développement ; faible en production.

## Symptôme

Sous React 18 Strict Mode (environnement de développement Vite), la vue d’ensemble du portail fournisseur peut rester indéfiniment sur « Chargement du tableau de bord… ».

## Cause

Le chargement initial utilise un garde `initialLoadDone` (`useRef`) :

1. Premier montage : `initialLoadDone.current = true`, les fetch démarrent, `loading* = true`.
2. Cleanup Strict Mode : `cancelled = true` → le `finally` **ne** remet **pas** les flags de chargement à `false`.
3. Remount : `initialLoadDone.current` est encore `true` → early return → **aucun nouveau fetch**, loadings restés à `true`.

## Code actuel (comportement fonctionnel antérieur, conservé)

```js
return () => {
  cancelled = true;
};
```

## Correctif proposé (patch indépendant)

```diff
     return () => {
       cancelled = true;
+      initialLoadDone.current = false;
     };
```

## Effets attendus

- Le remount peut relancer les **mêmes** 3 requêtes initiales (dashboard, produits assignés, notifications).
- En production (pas de double-mount Strict Mode) : quasi neutre ; re-fetch seulement si le composant se démonte puis remonte vraiment.

## Risques du patch

| Risque | Commentaire |
|--------|-------------|
| Doubles requêtes en Strict Mode | Une requête annulée + une utile |
| `setState` après démontage | Mitigé par le flag `cancelled` sur le premier cycle |
| Hors développement | Impact limité |

## Tests recommandés avant application

1. Dev + Strict Mode : overview charge sans spinner infini.
2. Navigation entre onglets (Mes envois, Créer, Notifications).
3. Build / preview production : un seul chargement initial au login fournisseur.
4. Logout / login fournisseur : données OK, pas d’avertissement setState orphelin.
5. Aucune écriture (pas d’envoi, pas de notification lue).

## Périmètre

Ne pas mélanger ce correctif avec un commit de redesign présentationnel.
