# 🔍 Debug AppHeader - Vérifications à Faire

## Problème
Le nouveau header AppHeader ne s'affiche pas, même après hard refresh sur plusieurs navigateurs.

## Vérifications Immédiates

### 1. Ouvrir la Console (F12)
Ouvrez la console et vérifiez :

**Cherchez ces messages :**
- ✅ `🚀 AppHeader chargé - version moderne avec shadcn/ui` → **AppHeader se charge**
- ✅ `📊 Props: ...` → **Les props sont passées**

**Si vous NE voyez PAS ces messages :**
- ❌ AppHeader n'est pas chargé → Problème d'import
- ❌ Vérifiez les erreurs en rouge dans la console

### 2. Vérifier l'Import dans App.jsx
Dans la console, tapez :
```javascript
// Vérifier si AppHeader est importé
import('./components/AppHeader').then(m => console.log('AppHeader module:', m))
```

### 3. Vérifier les Erreurs
**Cherchez des erreurs comme :**
- `Cannot find module '@/lib/utils'`
- `useData is not defined`
- `Cannot read property 'produits' of undefined`
- `Button is not a function`

### 4. Vérifier le Serveur Dev
Le serveur Vite doit être en cours d'exécution :
```bash
# Dans le terminal
ps aux | grep vite
```

Si rien ne s'affiche, redémarrez :
```bash
cd /Users/doctor/autoget
npm run dev
```

### 5. Vérifier l'URL
Assurez-vous d'accéder à :
- http://localhost:5173/ (ou le port affiché dans le terminal)

### 6. Test Direct dans la Console
Ouvrez la console (F12) et tapez :
```javascript
// Vérifier si React est chargé
window.React

// Vérifier si le composant est dans le DOM
document.querySelector('header h1')?.textContent

// Devrait afficher "COSMOS ALGÉRIE" si le nouveau header est là
```

## Actions Correctives

### Si vous voyez des erreurs d'import (@/...)
Vérifiez que `vite.config.js` a bien l'alias :
```js
alias: {
  '@': path.resolve(__dirname, 'src'),
}
```

### Si useData() ne fonctionne pas
Vérifiez que vous êtes bien dans le `<DataProvider>` dans App.jsx.

### Si les composants shadcn/ui ne se chargent pas
Vérifiez que les fichiers existent dans `src/components/ui/` :
- button.jsx
- badge.jsx
- sheet.jsx
- dropdown-menu.jsx
- etc.

## Solution Alternative : Force Rebuild

Si rien ne fonctionne :

```bash
cd /Users/doctor/autoget

# Nettoyer
rm -rf node_modules/.vite
rm -rf dist

# Redémarrer
npm run dev
```

Puis **hard refresh** dans le navigateur (Cmd+Shift+R).

## Debug Complet

Ouvrez la console et collez ce code :

```javascript
// Test complet
async function testAppHeader() {
  console.log('=== DEBUG APPHEADER ===');
  
  // 1. Vérifier React
  console.log('1. React:', typeof React !== 'undefined' ? '✅' : '❌');
  
  // 2. Vérifier le DOM
  const header = document.querySelector('header');
  console.log('2. Header dans DOM:', header ? '✅' : '❌');
  if (header) {
    console.log('   Contenu:', header.innerHTML.substring(0, 100));
  }
  
  // 3. Vérifier les imports
  try {
    const mod = await import('/src/components/AppHeader.jsx');
    console.log('3. AppHeader import:', mod ? '✅' : '❌');
  } catch (e) {
    console.log('3. AppHeader import:', '❌', e.message);
  }
  
  // 4. Vérifier les composants UI
  const hasButton = document.querySelector('button');
  console.log('4. Boutons dans DOM:', hasButton ? '✅' : '❌');
  
  console.log('=== FIN DEBUG ===');
}

testAppHeader();
```

## Résultats Attendus

Si tout fonctionne :
- ✅ Console: "🚀 AppHeader chargé"
- ✅ Header visible avec design moderne
- ✅ Pas de bandeau vert Supabase en haut
- ✅ Icônes lucide-react (pas d'emojis)

Si ça ne fonctionne toujours pas :
- Copiez TOUTES les erreurs de la console
- Notez ce qui s'affiche dans le header
- Envoyez-moi ces informations

