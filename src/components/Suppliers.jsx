import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Building2, CreditCard, TrendingDown, TrendingUp, Package, DollarSign, Calendar, Trash2, Edit, Phone, MapPin, ChevronRight } from 'lucide-react';
import SupplierDetail from './SupplierDetail';

const Suppliers = () => {
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  // Si un fournisseur est sélectionné, afficher sa page de détail
  if (selectedSupplierId) {
    return <SupplierDetail supplierId={selectedSupplierId} onBack={() => setSelectedSupplierId(null)} />;
  }

  // Sinon, afficher la liste
  return <SuppliersList onSelectSupplier={setSelectedSupplierId} />;
};

const SuppliersList = ({ onSelectSupplier }) => {
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
  const addFournisseur = dataCtx?.addFournisseur;
  const addPaiement = dataCtx?.addPaiement;
  const deletePaiement = dataCtx?.deletePaiement;
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  // Masquer toute la section pour les utilisateurs non-admin
  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accès Restreint</CardTitle>
            <CardDescription>
              Cette section est réservée aux administrateurs uniquement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Vous devez être administrateur pour accéder à la gestion des fournisseurs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [entreesDetails, setEntreesDetails] = useState({}); // { entreeId: lignes[] }
  const [loadingDetails, setLoadingDetails] = useState({});
  const [filters, setFilters] = useState({
    fournisseurId: '',
    dateStart: '',
    dateEnd: ''
  });
  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    adresse: ''
  });
  const [paiementData, setPaiementData] = useState({
    fournisseurId: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Helper functions - déclarer en premier avec useCallback pour stabilité
  const getProduitPrixAchat = useCallback((produitId) => {
    const produit = (state.produits || []).find(p => p.id === produitId);
    return produit ? (produit.prix_achat ?? produit.prixAchat ?? 0) : 0;
  }, [state.produits]);

  // Récupérer toutes les entrées d'un fournisseur avec leurs détails
  const getFournisseurEntrees = useCallback((fournisseurId) => {
    let filteredEntrees = (state.entrees || []).filter(e => {
      const fId = e.fournisseur_id ?? e.fournisseurId;
      return fId === fournisseurId;
    });

    // Appliquer les filtres de date si présents
    if (filters.dateStart && filters.dateEnd) {
      filteredEntrees = filteredEntrees.filter(e => {
        const entreeDate = e.date;
        return entreeDate >= filters.dateStart && entreeDate <= filters.dateEnd;
      });
    }

    return filteredEntrees;
  }, [state.entrees, filters.dateStart, filters.dateEnd]);

  // Obtenir les lignes d'une entrée - DOIT être déclaré tôt car utilisé dans globalTotals
  const getEntreeLignes = useCallback((entree) => {
    if (!USE_SUPABASE && entree.lignes) {
      return entree.lignes;
    }
    return entreesDetails[entree.id] || [];
  }, [entreesDetails]);

  // Calculer la valeur d'une entrée
  const calculateEntreeValue = useCallback((entree) => {
    if (!USE_SUPABASE && entree.lignes) {
      // Mode local : lignes déjà incluses
      return entree.lignes.reduce((sum, ligne) => {
        return sum + (ligne.quantite || 0) * getProduitPrixAchat(ligne.produitId);
      }, 0);
    }
    
    // Mode Supabase : utiliser les détails chargés
    if (USE_SUPABASE && entreesDetails[entree.id]) {
      return entreesDetails[entree.id].reduce((sum, ligne) => {
        const prix = ligne.produit_id?.prix_achat ?? 0;
        return sum + (ligne.quantite || 0) * prix;
      }, 0);
    }
    
    return 0;
  }, [getProduitPrixAchat, entreesDetails]);

  const calculateTotalDue = useCallback((fournisseurId) => {
    let total = 0;
    const entrees = getFournisseurEntrees(fournisseurId);
    
    entrees.forEach(entree => {
      if (!entree.paye) {
        total += calculateEntreeValue(entree);
      }
    });
    return total;
  }, [getFournisseurEntrees, calculateEntreeValue]);

  const calculateTotalPaye = useCallback((fournisseurId) => {
    let total = 0;
    let filteredPaiements = state.paiements || [];
    
    // Filtrer par fournisseur si sélectionné
    if (filters.fournisseurId) {
      filteredPaiements = filteredPaiements.filter(p => {
        const pFId = p.fournisseur_id ?? p.fournisseurId;
        return pFId === filters.fournisseurId;
      });
    }
    
    // Filtrer par date si sélectionné
    if (filters.dateStart && filters.dateEnd) {
      filteredPaiements = filteredPaiements.filter(p => {
        const paiementDate = p.date;
        return paiementDate >= filters.dateStart && paiementDate <= filters.dateEnd;
      });
    }
    
    filteredPaiements.forEach(paiement => {
      // Mode Supabase: fournisseur_id, Mode Local: fournisseurId
      const fId = paiement.fournisseur_id ?? paiement.fournisseurId;
      if (fId === fournisseurId) {
        total += parseFloat(paiement.montant || 0);
      }
    });
    return total;
  }, [state.paiements, filters.fournisseurId, filters.dateStart, filters.dateEnd]);

  const getProduitName = useCallback((produitId) => {
    const produit = (state.produits || []).find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  }, [state.produits]);

  // Filtrer les fournisseurs - DOIT être déclaré avant globalTotals
  const filteredFournisseurs = useMemo(() => {
    if (!filters.fournisseurId) return state.fournisseurs || [];
    return (state.fournisseurs || []).filter(f => f.id === filters.fournisseurId);
  }, [state.fournisseurs, filters.fournisseurId]);

  // Filtrer les paiements pour un fournisseur avec filtres de date - DOIT être déclaré avant globalTotals
  const getFilteredPaiements = (fournisseurId) => {
    let paiements = (state.paiements || []).filter(p => {
      // Mode Supabase: fournisseur_id, Mode Local: fournisseurId
      const fId = p.fournisseur_id ?? p.fournisseurId;
      return fId === fournisseurId;
    });

    if (filters.dateStart && filters.dateEnd) {
      paiements = paiements.filter(p => {
        const paiementDate = p.date;
        return paiementDate >= filters.dateStart && paiementDate <= filters.dateEnd;
      });
    }

    return paiements.reverse();
  };

  // Calculer tous les totaux globaux
  const globalTotals = useMemo(() => {
    let totalDueGlobal = 0;
    let totalPayeGlobal = 0;
    let totalMarchandiseGlobal = 0;
    let totalEntrees = 0;
    let totalEntreesPayees = 0;
    let totalEntreesNonPayees = 0;
    let totalPaiements = 0;
    let totalProduitsReçus = 0;
    
    // Calculer pour chaque fournisseur
    filteredFournisseurs.forEach(fournisseur => {
      const due = calculateTotalDue(fournisseur.id);
      const paye = calculateTotalPaye(fournisseur.id);
      const entrees = getFournisseurEntrees(fournisseur.id);
      const marchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);
      
      totalDueGlobal += due;
      totalPayeGlobal += paye;
      totalMarchandiseGlobal += marchandise;
      totalEntrees += entrees.length;
      totalEntreesPayees += entrees.filter(e => e.paye).length;
      totalEntreesNonPayees += entrees.filter(e => !e.paye).length;
      
      // Compter les produits dans les entrées
      entrees.forEach(entree => {
        const lignes = getEntreeLignes(entree);
        totalProduitsReçus += lignes.reduce((sum, ligne) => sum + (ligne.quantite || 0), 0);
      });
    });
    
    // Calculer les totaux des paiements
    let filteredPaiements = state.paiements || [];
    if (filters.fournisseurId) {
      filteredPaiements = filteredPaiements.filter(p => {
        const fId = p.fournisseur_id ?? p.fournisseurId;
        return fId === filters.fournisseurId;
      });
    }
    if (filters.dateStart && filters.dateEnd) {
      filteredPaiements = filteredPaiements.filter(p => {
        return p.date >= filters.dateStart && p.date <= filters.dateEnd;
      });
    }
    totalPaiements = filteredPaiements.length;
    
    // Statistiques additionnelles
    const fournisseursAvecDettes = filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length;
    const fournisseursEnAttente = filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length;
    const moyenneDueParFournisseur = filteredFournisseurs.length > 0 ? totalDueGlobal / filteredFournisseurs.length : 0;
    const moyennePayeParFournisseur = filteredFournisseurs.length > 0 ? totalPayeGlobal / filteredFournisseurs.length : 0;
    const tauxPaiement = totalDueGlobal > 0 ? (totalPayeGlobal / totalDueGlobal) * 100 : 0;
    
    return {
      totalDue: totalDueGlobal,
      totalPaye: totalPayeGlobal,
      reste: totalDueGlobal - totalPayeGlobal,
      totalMarchandise: totalMarchandiseGlobal,
      totalEntrees,
      totalEntreesPayees,
      totalEntreesNonPayees,
      totalPaiements,
      totalProduitsReçus,
      fournisseursAvecDettes,
      fournisseursEnAttente,
      moyenneDueParFournisseur,
      moyennePayeParFournisseur,
      tauxPaiement
    };
  }, [
    state.fournisseurs,
    state.entrees,
    state.paiements,
    filters,
    filteredFournisseurs,
    entreesDetails,
    calculateTotalDue,
    calculateTotalPaye,
    getFournisseurEntrees,
    calculateEntreeValue,
    getEntreeLignes
  ]);

  // Charger automatiquement les détails des entrées non payées pour le calcul
  useEffect(() => {
    if (USE_SUPABASE && dataCtx?.fetchEntreeDetails) {
      // Charger les détails de toutes les entrées non payées une par une
      const loadAll = async () => {
        for (const entree of (state.entrees || [])) {
          if (!entree.paye && !entreesDetails[entree.id] && !loadingDetails[entree.id]) {
            await loadEntreeDetails(entree.id);
          }
        }
      };
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entrees]);

  const handleAddFournisseur = async () => {
    if (!formData.nom) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez entrer un nom de fournisseur",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await addFournisseur(formData.nom, formData.contact, formData.adresse);
      } else {
        const newFournisseur = {
          id: generateId(),
          nom: formData.nom,
          contact: formData.contact,
          adresse: formData.adresse
        };
        dispatch({ type: ActionTypes.ADD_FOURNISSEUR, payload: newFournisseur });
      }
      setFormData({ nom: '', contact: '', adresse: '' });
      setShowModal(false);
      toast({
        title: "Succès",
        description: "Fournisseur ajouté avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleDeleteFournisseur = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      return;
    }
    try {
      if (USE_SUPABASE) {
        if (!dataCtx?.supabase) {
          throw new Error("Supabase client non initialisé");
        }
        const { error } = await dataCtx.supabase.from('fournisseurs').delete().eq('id', id);
        if (error) throw error;
        
        // Recharger les fournisseurs
        await dataCtx?.fetchFournisseurs?.();
        
        toast({
          title: "Succès",
          description: "Fournisseur supprimé avec succès",
        });
      } else {
        dispatch?.({ type: ActionTypes.DELETE_FOURNISSEUR, payload: id });
        toast({
          title: "Succès",
          description: "Fournisseur supprimé avec succès",
        });
      }
    } catch (e) {
      console.error('Erreur suppression fournisseur:', e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleAddPaiement = async () => {
    if (!paiementData.fournisseurId || !paiementData.montant || !paiementData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires (Fournisseur, Montant, Date)",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        if (!addPaiement) {
          throw new Error('Fonction addPaiement non disponible');
        }
        
        const dateFormatted = paiementData.date.includes('T') 
          ? paiementData.date.split('T')[0] 
          : paiementData.date;
        
        await addPaiement(
          paiementData.fournisseurId,
          parseFloat(paiementData.montant),
          dateFormatted,
          paiementData.description || ''
        );
      } else {
        const dateFormatted = paiementData.date.includes('T') 
          ? paiementData.date.split('T')[0] 
          : paiementData.date;
          
        const newPaiement = {
          id: generateId(),
          fournisseurId: paiementData.fournisseurId,
          montant: parseFloat(paiementData.montant),
          date: dateFormatted,
          description: paiementData.description || ''
        };
        dispatch({ type: ActionTypes.ADD_PAIEMENT, payload: newPaiement });
      }

      setPaiementData({
        fournisseurId: '',
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowPaiementModal(false);
      
      toast({
        title: "Succès",
        description: "Paiement enregistré avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleAddPaiement:', e);
    }
  };

  const handleDeletePaiement = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        if (!deletePaiement) {
          throw new Error('Fonction deletePaiement non disponible');
        }
        await deletePaiement(id);
      } else {
        dispatch?.({ type: ActionTypes.DELETE_PAIEMENT, payload: id });
      }
      toast({
        title: "Succès",
        description: "Paiement supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleDeletePaiement:', e);
    }
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = (state.fournisseurs || []).find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  // Charger les détails d'une entrée (Supabase)
  const loadEntreeDetails = async (entreeId) => {
    if (!USE_SUPABASE || loadingDetails[entreeId] || entreesDetails[entreeId]) return;
    
    setLoadingDetails(prev => ({ ...prev, [entreeId]: true }));
    try {
      const details = await dataCtx?.fetchEntreeDetails?.(entreeId);
      setEntreesDetails(prev => ({ ...prev, [entreeId]: details || [] }));
    } catch (e) {
      console.error('Erreur chargement détails entrée:', e);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [entreeId]: false }));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Fournisseurs</h1>
        <div className="flex gap-3">
          <Dialog open={showPaiementModal} onOpenChange={setShowPaiementModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white border-green-600">
                <CreditCard className="h-4 w-4 mr-2" />
                Nouveau Paiement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouveau Paiement</DialogTitle>
                <DialogDescription>
                  Enregistrez un nouveau paiement pour un fournisseur
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Fournisseur *</label>
                  <select
                    value={paiementData.fournisseurId}
                    onChange={(e) => setPaiementData({ ...paiementData, fournisseurId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Sélectionner</option>
                    {(state.fournisseurs || []).map((fournisseur) => {
                      const due = calculateTotalDue(fournisseur.id);
                      return (
                        <option key={fournisseur.id} value={fournisseur.id}>
                          {fournisseur.nom} {due > 0 ? `(Dû: ${due.toFixed(2)}DA)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Montant (DA) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paiementData.montant}
                    onChange={(e) => setPaiementData({ ...paiementData, montant: e.target.value })}
                  />
                </div>

                {paiementData.fournisseurId && (
                  <Card>
                    <CardContent className="pt-6">
                      {(() => {
                        const currentTotalDue = calculateTotalDue(paiementData.fournisseurId);
                        const currentTotalPaye = calculateTotalPaye(paiementData.fournisseurId);
                        const restantActuel = currentTotalDue - currentTotalPaye;
                        const montantPaiement = parseFloat(paiementData.montant) || 0;
                        const nouveauReste = restantActuel - montantPaiement;
                        
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Reste actuel:</span>
                              <span className="font-semibold text-orange-600">{restantActuel.toFixed(2)} DA</span>
                            </div>
                            {montantPaiement > 0 && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Paiement:</span>
                                  <span className="font-semibold text-green-600">-{montantPaiement.toFixed(2)} DA</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                  <span className="font-semibold">Nouveau reste:</span>
                                  <span className={`font-bold text-lg ${nouveauReste > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {nouveauReste.toFixed(2)} DA
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Date *</label>
                  <Input
                    type="date"
                    value={paiementData.date}
                    onChange={(e) => setPaiementData({ ...paiementData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={paiementData.description}
                    onChange={(e) => setPaiementData({ ...paiementData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaiementModal(false);
                    setPaiementData({
                      fournisseurId: '',
                      montant: '',
                      date: new Date().toISOString().split('T')[0],
                      description: ''
                    });
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleAddPaiement}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Fournisseur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau Fournisseur</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau fournisseur à votre base de données
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nom *</label>
                  <Input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Contact</label>
                  <Input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Adresse</label>
                  <Textarea
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ nom: '', contact: '', adresse: '' });
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleAddFournisseur}>
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Résumé Global */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'Ensemble Globale</CardTitle>
          <CardDescription>Statistiques complètes sur tous les fournisseurs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Dû</p>
                    <p className="text-3xl font-bold text-destructive">{globalTotals.totalDue.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length} fournisseur{filteredFournisseurs.filter(f => calculateTotalDue(f.id) > 0).length !== 1 ? 's' : ''} avec dettes
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Payé</p>
                    <p className="text-3xl font-bold text-green-600">{globalTotals.totalPaye.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalTotals.totalPaye > 0 
                        ? `${((globalTotals.totalPaye / (globalTotals.totalDue || 1)) * 100).toFixed(1)}% du total dû`
                        : 'Aucun paiement enregistré'
                      }
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${globalTotals.reste > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {globalTotals.reste > 0 ? 'Reste à Payer' : 'Solde Positif'}
                    </p>
                    <p className={`text-3xl font-bold ${globalTotals.reste > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {Math.abs(globalTotals.reste).toFixed(2)} DA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalTotals.reste > 0 
                        ? `${filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length} fournisseur${filteredFournisseurs.filter(f => (calculateTotalDue(f.id) - calculateTotalPaye(f.id)) > 0).length !== 1 ? 's' : ''} en attente`
                        : 'Toutes les dettes sont payées'
                      }
                    </p>
                  </div>
                  {globalTotals.reste > 0 ? (
                    <TrendingDown className="h-8 w-8 text-orange-600" />
                  ) : (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Fournisseurs</p>
              <p className="text-xl font-bold">{filteredFournisseurs.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Actifs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Entrées Totales</p>
              <p className="text-xl font-bold">{globalTotals.totalEntrees}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {globalTotals.totalEntreesPayees} payées / {globalTotals.totalEntreesNonPayees} non payées
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Paiements Totaux</p>
              <p className="text-xl font-bold">{globalTotals.totalPaiements}</p>
              <p className="text-xs text-muted-foreground mt-1">Transactions</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valeur Marchandise</p>
              <p className="text-xl font-bold">{globalTotals.totalMarchandise.toFixed(2)} DA</p>
              <p className="text-xs text-muted-foreground mt-1">Total reçu</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Produits Reçus</p>
              <p className="text-xl font-bold">{globalTotals.totalProduitsReçus}</p>
              <p className="text-xs text-muted-foreground mt-1">Unités</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Taux Paiement</p>
              <p className="text-xl font-bold">{globalTotals.tauxPaiement.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Pourcentage payé</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Fournisseurs avec Dettes</p>
              <p className="text-xl font-bold">{globalTotals.fournisseursAvecDettes}</p>
              <p className="text-xs text-muted-foreground mt-1">En attente paiement</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Fournisseurs en Attente</p>
              <p className="text-xl font-bold">{globalTotals.fournisseursEnAttente}</p>
              <p className="text-xs text-muted-foreground mt-1">Non réglés</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Moyenne Due/Fournisseur</p>
              <p className="text-xl font-bold">{globalTotals.moyenneDueParFournisseur.toFixed(2)} DA</p>
              <p className="text-xs text-muted-foreground mt-1">Par fournisseur</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Moyenne Payée/Fournisseur</p>
              <p className="text-xl font-bold">{globalTotals.moyennePayeParFournisseur.toFixed(2)} DA</p>
              <p className="text-xs text-muted-foreground mt-1">Par fournisseur</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Entrées Payées</p>
              <p className="text-xl font-bold">{globalTotals.totalEntreesPayees}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {globalTotals.totalEntrees > 0 ? `${((globalTotals.totalEntreesPayees / globalTotals.totalEntrees) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Entrées Non Payées</p>
              <p className="text-xl font-bold">{globalTotals.totalEntreesNonPayees}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {globalTotals.totalEntrees > 0 ? `${((globalTotals.totalEntreesNonPayees / globalTotals.totalEntrees) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fournisseur</label>
              <select
                value={filters.fournisseurId}
                onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Tous les fournisseurs</option>
                {(state.fournisseurs || []).map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date début</label>
              <Input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date fin</label>
              <Input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
              />
            </div>
          </div>
          {(filters.fournisseurId || filters.dateStart || filters.dateEnd) && (
            <Button
              onClick={() => setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' })}
              variant="outline"
              className="mt-4"
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Liste des fournisseurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredFournisseurs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">Aucun fournisseur trouvé</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredFournisseurs.map((fournisseur) => {
            const totalDue = calculateTotalDue(fournisseur.id);
            const totalPaye = calculateTotalPaye(fournisseur.id);
            const reste = totalDue - totalPaye;
            const paiements = getFilteredPaiements(fournisseur.id);
            const entrees = getFournisseurEntrees(fournisseur.id);
            const entreesPayees = entrees.filter(e => e.paye).length;
            const entreesNonPayees = entrees.filter(e => !e.paye).length;
            const totalMarchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);
            
            return (
              <Card 
                key={fournisseur.id} 
                className="overflow-hidden cursor-pointer hover:shadow-xl transition-all border-2 hover:border-primary hover:scale-[1.02]"
                onClick={() => onSelectSupplier(fournisseur.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-1">{fournisseur.nom}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cliquez pour voir les détails
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin() && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFournisseur(fournisseur.id);
                          }}
                          variant="ghost"
                          size="icon"
                        >
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                      )}
                      <ChevronRight className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <Package className="h-5 w-5 mx-auto mb-1 text-primary/50" />
                      <p className="text-xl font-bold">{entrees.length}</p>
                      <p className="text-xs text-muted-foreground">Entrées</p>
                    </div>
                    <div className="text-center">
                      <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-500/50" />
                      <p className="text-xl font-bold">{paiements.length}</p>
                      <p className="text-xs text-muted-foreground">Paiements</p>
                    </div>
                    <div className="text-center">
                      <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-500/50" />
                      <p className="text-xl font-bold">{totalMarchandise.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">DA Total</p>
                    </div>
                    <div className="text-center">
                      {reste > 0 ? (
                        <TrendingDown className="h-5 w-5 mx-auto mb-1 text-orange-500/50" />
                      ) : (
                        <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-500/50" />
                      )}
                      <p className={`text-xl font-bold ${reste > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                        {Math.abs(reste).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">{reste > 0 ? 'À payer' : 'Crédit'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Suppliers;
