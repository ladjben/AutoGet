# 🚀 Activer Supabase - Instructions Simplifiées

## 📋 ÉTAPE 1: Exécuter le SQL (2 minutes)

1. Allez sur: https://supabase.com/dashboard/project/nyehvkzhflxrewllwjzv
2. Cliquez sur **"SQL Editor"** dans le menu
3. Copiez **TOUT** le contenu du fichier `supabase-schema-complet.sql`
4. Collez dans l'éditeur SQL
5. Cliquez sur **"Run"** (Exécuter)

✅ Les 8 tables seront créées + 2 comptes par défaut

## 📋 ÉTAPE 2: Activer dans le code (30 secondes)

1. Ouvrez le fichier `src/config.js`
2. Changez:
   ```javascript
   export const USE_SUPABASE = true;  // Au lieu de false
   ```
3. Enregistrez le fichier

## 📋 ÉTAPE 3: Déployer (optionnel)

Si vous êtes en local, rechargez la page (F5).

Si vous êtes sur Vercel, poussez les changements:
```bash
git add src/config.js
git commit -m "Activer Supabase"
git push
```

## ✅ C'EST FINI!

Votre application utilisera Supabase et les données seront dans le cloud!

---

**Besoin d'aide?** Voir `INSTRUCTIONS_FINALES_SUPABASE.md`

