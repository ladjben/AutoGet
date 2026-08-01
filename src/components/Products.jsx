/**
 * Produits — présentation uniquement.
 * CRUD, validations, permissions isAdmin, dual Supabase/local inchangés.
 */
import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Package, Search, MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';

const formatDa = (n) =>
  `${Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

function MetaStat({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const Products = () => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? []
  };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addProduit = dataCtx?.addProduit;
  const updateProduit = dataCtx?.updateProduit;
  const deleteProduit = dataCtx?.deleteProduit;
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    reference: '',
    prixAchat: ''
  });

  // Statistiques globales
  const stats = useMemo(() => {
    const produits = state.produits || [];
    const totalProduits = produits.length;
    const valeurTotale = produits.reduce((sum, p) => {
      const prix = p.prix_achat ?? p.prixAchat ?? 0;
      return sum + prix;
    }, 0);
    const prixMoyen = totalProduits > 0 ? valeurTotale / totalProduits : 0;
    const prixMax = produits.length > 0 ? Math.max(...produits.map(p => p.prix_achat ?? p.prixAchat ?? 0)) : 0;
    const prixMin = produits.length > 0 ? Math.min(...produits.map(p => p.prix_achat ?? p.prixAchat ?? 0).filter(p => p > 0)) : 0;
    
    return {
      totalProduits,
      valeurTotale,
      prixMoyen,
      prixMax,
      prixMin
    };
  }, [state.produits]);

  // Filtre présentation uniquement (nom / référence)
  const filteredProduits = useMemo(() => {
    const list = state.produits || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const nom = String(p.nom || '').toLowerCase();
      const ref = String(p.reference || '').toLowerCase();
      return nom.includes(q) || ref.includes(q);
    });
  }, [state.produits, searchQuery]);

  const handleAddProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires (nom, prix d'achat)",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await addProduit(formData.nom, formData.reference, parseFloat(formData.prixAchat));
      } else {
        const newProduit = {
          id: generateId(),
          nom: formData.nom,
          reference: formData.reference,
          prixAchat: parseFloat(formData.prixAchat)
        };
        dispatch({ type: ActionTypes.ADD_PRODUIT, payload: newProduit });
      }
      toast({
        title: "Succès",
        description: "Produit ajouté avec succès",
      });
      resetForm();
      setShowModal(false);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || "Erreur lors de l'ajout du produit",
      });
    }
  };

  const handleUpdateProduit = async () => {
    if (!formData.nom || !formData.prixAchat) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        const prix_achat = parseFloat(formData.prixAchat)
        await updateProduit?.(editingProduit.id, {
          nom: formData.nom,
          reference: formData.reference,
          prix_achat,
        })
        toast({
          title: "Succès",
          description: "Produit modifié avec succès",
        });
      } else {
        const updatedProduit = {
          ...editingProduit,
          nom: formData.nom,
          reference: formData.reference,
          prixAchat: parseFloat(formData.prixAchat)
        };
        dispatch({ type: ActionTypes.UPDATE_PRODUIT, payload: updatedProduit });
        toast({
          title: "Succès",
          description: "Produit modifié avec succès",
        });
      }
      resetForm();
      setShowModal(false);
      setEditingProduit(null);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || "Erreur lors de la modification du produit",
      });
    }
  };

  const handleDeleteProduit = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteProduit?.(id);
      } else {
        dispatch?.({ type: ActionTypes.DELETE_PRODUIT, payload: id });
      }
      toast({
        title: "Succès",
        description: "Produit supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur lors de la suppression',
      });
    }
  };

  const openEditModal = (produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom,
      reference: produit.reference || '',
      prixAchat: produit.prix_achat ?? produit.prixAchat ?? ''
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingProduit(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ nom: '', reference: '', prixAchat: '' });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduit(null);
    resetForm();
  };

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Produits"
        description="Gestion du catalogue — nom, référence et prix d'achat (DA)."
        actions={
          <Button onClick={openCreateModal} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
        }
      />

      {/* Stats compactes */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetaStat label="Produits" value={formatNum(stats.totalProduits)} />
        <MetaStat label="Valeur totale" value={formatDa(stats.valeurTotale)} />
        <MetaStat label="Prix moyen" value={formatDa(stats.prixMoyen)} />
        <MetaStat label="Prix max" value={formatDa(stats.prixMax)} />
        <MetaStat label="Prix min" value={formatDa(stats.prixMin)} />
      </div>

      {/* Recherche + liste */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Liste des produits
            </h2>
            <p className="text-xs text-muted-foreground">
              {filteredProduits.length}
              {searchQuery.trim()
                ? ` résultat(s) · ${stats.totalProduits} au total`
                : ` produit(s) enregistré(s)`}
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom ou référence…"
              className="pl-8"
              aria-label="Rechercher un produit"
            />
          </div>
        </div>

        {(state.produits || []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Aucun produit enregistré</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Créez votre premier produit pour démarrer le catalogue.
            </p>
            <Button className="mt-4" size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </Button>
          </div>
        ) : filteredProduits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun produit ne correspond à « {searchQuery.trim()} »
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Nom</th>
                    <th className="px-3 py-2.5 font-medium">Référence</th>
                    <th className="px-3 py-2.5 text-right font-medium">Prix d&apos;achat</th>
                    <th className="w-12 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProduits.map((produit) => (
                    <tr
                      key={produit.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2.5 font-medium">{produit.nom}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {produit.reference || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatDa(produit.prix_achat ?? produit.prixAchat ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openEditModal(produit)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            {isAdmin() && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteProduit(produit.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {filteredProduits.map((produit) => (
                <div
                  key={produit.id}
                  className="rounded-lg border border-border/80 bg-card px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{produit.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {produit.reference ? `Réf. ${produit.reference}` : 'Sans référence'}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatDa(produit.prix_achat ?? produit.prixAchat ?? 0)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEditModal(produit)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        {isAdmin() && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteProduit(produit.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Add/Edit Product Dialog */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open) closeModal();
          else setShowModal(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduit ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
            <DialogDescription>
              {editingProduit
                ? 'Modifiez les informations du produit'
                : 'Ajoutez un nouveau produit à votre catalogue'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="produit-nom">
                Nom *
              </label>
              <Input
                id="produit-nom"
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Nom du produit"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="produit-ref">
                Référence
              </label>
              <Input
                id="produit-ref"
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Référence du produit (optionnel)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="produit-prix">
                Prix d&apos;achat (DA) *
              </label>
              <Input
                id="produit-prix"
                type="number"
                step="0.01"
                value={formData.prixAchat}
                onChange={(e) => setFormData({ ...formData, prixAchat: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={editingProduit ? handleUpdateProduit : handleAddProduit}>
              {editingProduit ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSurface>
  );
};

export default Products;
