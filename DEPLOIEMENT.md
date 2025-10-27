# 🚀 Guide de Déploiement

## Option 1: Vercel (Recommandé - Gratuit et Facile)

### Étapes:

1. **Installer Vercel CLI** (optionnel, vous pouvez aussi utiliser le site web)
```bash
npm install -g vercel
```

2. **Build de l'application**
```bash
npm run build
```

3. **Déployer avec Vercel CLI**
```bash
vercel
```

OU déployer via le site web:
- Allez sur https://vercel.com
- Connectez votre compte GitHub
- Importez le projet
- Cliquez sur "Deploy"
- Vercel détecte automatiquement Vite !

### Avantages:
- ✅ Gratuit
- ✅ Déploiement automatique à chaque push
- ✅ HTTPS automatique
- ✅ Très rapide

---

## Option 2: Netlify (Très Simple)

### Étapes:

1. **Build de l'application**
```bash
npm run build
```

2. **Aller sur Netlify**
- Allez sur https://netlify.com
- Connectez votre compte GitHub
- Cliquez sur "New site from Git"
- Sélectionnez votre repository

OU glissez-déposez:
- Allez sur https://app.netlify.com/drop
- Glissez le dossier `dist` créé par `npm run build`

3. **Configuration** (optionnel)
Créez un fichier `netlify.toml` à la racine:
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### Avantages:
- ✅ Gratuit
- ✅ Déploiement en drag & drop
- ✅ HTTPS automatique

---

## Option 3: GitHub Pages

### Étapes:

1. **Installer gh-pages**
```bash
npm install --save-dev gh-pages
```

2. **Modifier package.json**
Ajoutez ces scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

3. **Déployer**
```bash
npm run deploy
```

4. **Configurer GitHub**
- Allez dans Settings > Pages de votre repository
- Sélectionnez la branche `gh-pages`

### Note: 
- L'URL sera: `https://votrenom.github.io/autoget`
- Vous devrez configurer le base path dans `vite.config.js`:
```js
export default {
  base: '/autoget/',
  // ... autres config
}
```

---

## Option 4: Supabase (Frontend Static Hosting)

Votre compte Supabase inclut un hosting gratuit !

### Étapes:

1. **Build de l'application**
```bash
npm run build
```

2. **Aller dans Supabase Dashboard**
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- Allez dans "Storage"
- Créez un bucket public

3. **Upload du dossier dist**
- Allez dans Storage
- Upload tout le contenu du dossier `dist`

4. **Configurer le domaine**
- Dans Settings > API
- Configurez un custom domain (optionnel)

---

## Option 5: Firebase Hosting

### Étapes:

1. **Installer Firebase CLI**
```bash
npm install -g firebase-tools
```

2. **Login**
```bash
firebase login
```

3. **Initialiser**
```bash
firebase init hosting
```

4. **Build et Deploy**
```bash
npm run build
firebase deploy
```

---

## ✅ Configuration pour tous les déploiements

### 1. Créer un dépôt GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/votrenom/autoget.git
git push -u origin main
```

### 2. Vérifier le build localement

```bash
npm run build
npm run preview
```

Ouvrez http://localhost:4173 pour voir la version de production.

---

## 📦 Build pour production

À chaque fois que vous voulez déployer:

```bash
npm run build
```

Le dossier `dist/` contient tout ce dont vous avez besoin pour déployer.

---

## 🎯 Recommandation

**Pour votre cas**, je recommande **Vercel** car:
- ✅ Gratuit
- ✅ Super facile à utiliser
- ✅ Déploiement en 2 minutes
- ✅ Configuration automatique pour Vite
- ✅ URL personnalisée gratuite

### Déploiement rapide avec Vercel:

1. Poussez votre code sur GitHub
2. Allez sur https://vercel.com
3. Cliquez "Import Project"
4. Sélectionnez votre repository
5. Cliquez "Deploy"
6. C'est tout ! 🎉

Votre app sera accessible sur: `https://autoget.vercel.app` (ou un autre domaine si vous en configurez un)

---

## 🔧 Configuration supplémentaire

### Environnement variables (si vous utilisez Supabase)

Créez un fichier `.env.production`:
```env
VITE_SUPABASE_URL=https://nyehvkzhflxrewllwjzv.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé
```

Puis dans votre code:
```js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

---

## 📝 Notes importantes

⚠️ **LocalStorage ne fonctionnera pas**
- Les données sont stockées dans le navigateur
- Chaque utilisateur a ses propres données
- Pas de synchronisation entre appareils

✅ **Pour avoir des données partagées**
- Configurez Supabase (voir INSTRUCTIONS_SUPABASE.md)
- Changez `USE_SUPABASE` à `true` dans `src/config.js`
- Les données seront stockées dans Supabase

---

## 🚀 Prêt à déployer!

Choisissez l'option qui vous convient et suivez les étapes ci-dessus. N'hésitez pas si vous avez besoin d'aide !

