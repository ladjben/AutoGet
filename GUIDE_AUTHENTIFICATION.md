# 🔐 Guide d'Authentification

## ✅ Système d'Authentification Implémenté

Votre application a maintenant un système d'authentification complet avec deux rôles:

### 👨‍💼 **Administrateur**
- **Pouvoirs**: Peut TOUT faire (ajouter, éditer, supprimer)
- **Utilisateur**: `admin`
- **Mot de passe**: `admin123`
- **Icône**: 🔴 Administrateur (rouge)

### 👤 **Utilisateur**
- **Pouvoirs**: Peut AJOUTER uniquement (produits, entrées, fournisseurs, paiements)
- **Interdictions**: Ne peut PAS supprimer ni éditer
- **Utilisateur**: `user`
- **Mot de passe**: `user123`
- **Icône**: 🔵 Utilisateur (bleu)

## 🚀 Comment Utiliser

### Page de Connexion

Au démarrage de l'application, une page de connexion s'affiche avec:

```
👟 Gestion Chaussures
Connectez-vous pour continuer

Nom d'utilisateur: [_______]
Mot de passe:     [_______]

[  Se connecter  ]

Comptes de démonstration:
👨‍💼 Administrateur
Nom: admin | Pass: admin123
Peut tout faire

👤 Utilisateur
Nom: user | Pass: user123
Peut ajouter uniquement
```

### Interface Après Connexion

Une fois connecté, la navigation affiche:
- Le nom de l'utilisateur
- Le rôle (🔴 Admin ou 🔵 User)
- Un bouton "Déconnexion"

### Permissions Détaillées

#### ✅ Administrateur Peut:
- ✅ Ajouter des produits, entrées, fournisseurs, paiements
- ✅ Éditer tous les éléments
- ✅ Supprimer tous les éléments
- ✅ Voir toutes les statistiques

#### ✅ Utilisateur Peut:
- ✅ Ajouter des produits
- ✅ Ajouter des entrées de stock
- ✅ Ajouter des fournisseurs
- ✅ Ajouter des paiements
- ✅ Voir toutes les données

#### ❌ Utilisateur NE PEUT PAS:
- ❌ Supprimer des produits
- ❌ Supprimer des entrées
- ❌ Supprimer des fournisseurs
- ❌ Supprimer des paiements
- ❌ Voir les boutons de suppression

## 🎯 Exemples d'Utilisation

### Scénario 1: Admin Gère Tout
1. Connectez-vous avec `admin` / `admin123`
2. Ajoutez des produits, fournisseurs, entrées
3. Éditez et supprimez selon vos besoins
4. Tous les boutons sont visibles

### Scénario 2: User Ajoute des Données
1. Connectez-vous avec `user` / `user123`
2. Ajoutez des produits (bouton "+ Nouveau Produit" visible)
3. Les boutons "Supprimer" ne sont pas visibles
4. Les boutons "Éditer" fonctionnent normalement

## 🔄 Déconnexion

Cliquez sur le bouton "Déconnexion" en haut à droite pour vous déconnecter.

La session est sauvegardée, donc si vous rafraîchissez la page, vous restez connecté.

## 📝 Notes Techniques

- **Stockage**: Les informations d'authentification sont stockées dans le localStorage
- **Persistance**: La session persiste entre les rafraîchissements
- **Sécurité**: Ceci est une authentification simple pour développement
- **Production**: Pour un environnement de production, utilisez Supabase Auth ou un autre système

## 🆘 Dépannage

### "Mot de passe incorrect"
- Vérifiez que vous utilisez les comptes de démonstration
- Admin: `admin` / `admin123`
- User: `user` / `user123`

### "Je ne vois pas les boutons de suppression"
- Vérifiez que vous êtes connecté en tant qu'admin
- Les users ne voient pas ces boutons (comportement normal)

### "Le bouton de déconnexion ne fonctionne pas"
- Rafraîchissez la page
- Videz le localStorage si nécessaire

---

**Votre système d'authentification est prêt! 🎉**

