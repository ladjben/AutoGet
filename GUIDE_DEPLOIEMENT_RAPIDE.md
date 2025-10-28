# 🚀 Guide de Déploiement Rapide

## ✅ Ce qui est déjà fait:
- ✅ Code Git commité
- ✅ Remote GitHub configuré: `https://github.com/ladjben/autoget.git`
- ✅ Branch main configurée
- ✅ Build de production prêt dans `dist/`

## 📤 Étape 1: Pousser sur GitHub

Vous avez **2 options**:

### Option A: Via Terminal (Recommandé)

```bash
cd /Users/doctor/autoget
git push -u origin main
```

Quand il vous demande votre nom d'utilisateur et mot de passe:
- **Username:** `ladjben`
- **Password:** Utilisez un **Personal Access Token** (PAS votre mot de passe GitHub)

👉 **Pour créer un token**: https://github.com/settings/tokens
- Cliquez "Generate new token"
- Donnez-lui un nom: "autoget-deploy"
- Cochez `repo` dans les permissions
- Copiez le token et utilisez-le comme mot de passe

### Option B: Créer le dépôt sur GitHub d'abord

1. Allez sur: **https://github.com/new**
2. Nom du repository: **`autoget`**
3. **NE PAS cocher** "Initialize with README"
4. Cliquez **"Create repository"**
5. Puis exécutez:
```bash
git push -u origin main
```

---

## 🌐 Étape 2: Déployer sur Vercel

Une fois le code sur GitHub:

1. Allez sur: **https://vercel.com**
2. Cliquez **"Sign Up"** (connectez-vous si vous avez déjà un compte)
3. Choisissez **"Continue with GitHub"**
4. Autorisez Vercel à accéder à vos repos GitHub
5. Cliquez **"Add New Project"**
6. Sélectionnez le repo **`ladjben/autoget`**
7. Vercel détectera automatiquement Vite
8. Cliquez **"Deploy"**

⏱️ **Environ 1 minute**, votre app sera en ligne!

---

## 🔗 Votre URL

Vous aurez une URL comme:
- `https://autoget.vercel.app`
- Ou `https://autoget-ladjben.vercel.app`

Vous pouvez la personnaliser dans les paramètres Vercel!

---

## ✅ C'est tout!

Votre application sera en ligne et accessible publiquement.

**Chaque modification** sera automatiquement déployée:
- Modifiez le code
- Committez: `git add . && git commit -m "message"`
- Poussez: `git push`
- Vercel redéploie automatiquement! 🎉

---

**Besoin d'aide?** Consultez `INSTRUCTIONS_DEPLOIEMENT.md`

