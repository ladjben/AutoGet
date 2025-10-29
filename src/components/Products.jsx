import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package } from 'lucide-react';

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
        await dataCtx?.updateProduit?.(editingProduit.id, {
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

  const resetForm = () => {
    setFormData({ nom: '', reference: '', prixAchat: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Produits</h1>
        <Button onClick={() => {
          setEditingProduit(null);
          resetForm();
          setShowModal(true);
        }}>
          <Plus className="h-4 w-4" />
          Nouveau Produit
        </Button>
      </div>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Global</CardTitle>
          <CardDescription>Statistiques des produits enregistrés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Produits</p>
                    <p className="text-2xl font-bold">{stats.totalProduits}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valeur Totale</p>
                    <p className="text-2xl font-bold">{stats.valeurTotale.toFixed(2)} DA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Prix Moyen</p>
                    <p className="text-2xl font-bold">{stats.prixMoyen.toFixed(2)} DA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Prix Maximum</p>
                    <p className="text-2xl font-bold">{stats.prixMax.toFixed(2)} DA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Prix Minimum</p>
                    <p className="text-2xl font-bold">{stats.prixMin.toFixed(2)} DA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Produits</CardTitle>
          <CardDescription>{state.produits.length} produit(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {state.produits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">Aucun produit enregistré</p>
              </div>
            ) : (
              state.produits.map((produit) => (
                <Card key={produit.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <Package className="h-8 w-8 text-primary" />
                          <div>
                            <h3 className="text-xl font-semibold">{produit.nom}</h3>
                            {produit.reference && (
                              <p className="text-sm text-muted-foreground">Référence: {produit.reference}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Prix d'achat</p>
                            <p className="text-lg font-semibold">
                              {produit.prix_achat ?? produit.prixAchat ?? 0} DA
                            </p>
                          </div>
                          {produit.reference && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Référence</p>
                              <p className="text-lg font-semibold">{produit.reference}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-6">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(produit)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Éditer
                        </Button>
                        {isAdmin() && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteProduit(produit.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduit ? 'Modifier le Produit' : 'Nouveau Produit'}</DialogTitle>
            <DialogDescription>
              {editingProduit ? 'Modifiez les informations du produit' : 'Ajoutez un nouveau produit à votre catalogue'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom *</label>
              <Input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Nom du produit"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Référence</label>
              <Input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Référence du produit (optionnel)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prix d'achat (DA) *</label>
              <Input
                type="number"
                step="0.01"
                value={formData.prixAchat}
                onChange={(e) => setFormData({ ...formData, prixAchat: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingProduit(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button onClick={editingProduit ? handleUpdateProduit : handleAddProduit}>
              {editingProduit ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
