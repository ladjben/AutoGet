# Guide de Modernisation avec shadcn/ui

## ✅ Composants déjà modernisés

### 1. Products.jsx
- ✅ Remplacé les styles manuels par Card, CardHeader, CardTitle, CardContent
- ✅ Modal remplacée par Dialog avec DialogContent, DialogHeader, DialogTitle
- ✅ Input shadcn utilisé
- ✅ Button avec variants (default, outline, destructive)
- ✅ Toast ajouté pour succès/erreurs
- ✅ Icônes lucide-react (Plus, Edit, Trash2, Package)

## 📝 Pattern à suivre pour les autres pages

### Structure standard d'une page :
```jsx
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

// Dans le composant:
const { toast } = useToast()

// Structure Card pour chaque section:
<Card>
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenu */}
  </CardContent>
</Card>

// Dialog au lieu de modal HTML:
<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titre</DialogTitle>
    </DialogHeader>
    {/* Contenu du formulaire */}
    <DialogFooter>
      <Button variant="outline">Annuler</Button>
      <Button>Enregistrer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Toast pour les actions:
toast({
  title: "Succès",
  description: "Action réussie",
})
```

## 🎨 Classes Tailwind à utiliser

- Text: `text-foreground`, `text-muted-foreground`
- Background: `bg-background`, `bg-card`, `bg-muted`
- Borders: `border`, `border-input`
- Spacing: Utiliser le spacing standard de shadcn (p-6, gap-4, space-y-4)

## 📋 Checklist pour chaque page

- [ ] Remplacer tous les `<div>` de style par `<Card>`
- [ ] Remplacer les modals HTML par `<Dialog>`
- [ ] Remplacer tous les `<input>` par `<Input>` de shadcn
- [ ] Remplacer tous les `<button>` par `<Button>` avec variants appropriés
- [ ] Ajouter `useToast` et toasts pour chaque action
- [ ] Utiliser `Table` pour les listes tabulaires
- [ ] Utiliser des icônes `lucide-react` au lieu d'emojis
- [ ] Supprimer tous les styles inline et gradients personnalisés
- [ ] Utiliser les tokens de couleur shadcn (text-foreground, bg-card, etc.)

## 📚 Pages restantes à moderniser

1. Dashboard.jsx - En cours
2. Entries.jsx
3. Suppliers.jsx
4. Depenses.jsx
5. Colis.jsx
6. Navigation.jsx (optionnel mais recommandé)

