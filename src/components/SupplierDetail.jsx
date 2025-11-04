import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Building2, CreditCard, TrendingDown, TrendingUp, Package, DollarSign, Calendar, Trash2, Phone, MapPin, ChevronRight, ChevronDown, Plus } from 'lucide-react';

const SupplierDetail = ({ supplierId, onBack }) => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
  };
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [entreesDetails, setEntreesDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [expandedEntrees, setExpandedEntrees] = useState({});
  const [loadingPage, setLoadingPage] = useState(true);
  const [paiementData, setPaiementData] = useState({
    fournisseurId: supplierId,
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Trouver le fournisseur
  const fournisseur = useMemo(() => {
    return (state.fournisseurs || []).find(f => f.id === supplierId);
  }, [state.fournisseurs, supplierId]);

  if (!fournisseur) {
    return (
      <div className="space-y-6">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg">Fournisseur non trouvé</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper functions
  const getProduitPrixAchat = useCallback((produitId) => {
    const produit = (state.produits || []).find(p => p.id === produitId);
    return produit ? (produit.prix_achat ?? produit.prixAchat ?? 0) : 0;
  }, [state.produits]);

  const getFournisseurEntrees = useCallback(() => {
    return (state.entrees || []).filter(e => {
      const fId = e.fournisseur_id ?? e.fournisseurId;
      return fId === supplierId;
    });
  }, [state.entrees, supplierId]);

  const getEntreeLignes = useCallback((entree) => {
    if (!USE_SUPABASE && entree.lignes) {
      return entree.lignes;
    }
    return entreesDetails[entree.id] || [];
  }, [entreesDetails]);

  const calculateEntreeValue = useCallback((entree) => {
    const lignes = getEntreeLignes(entree);
    return lignes.reduce((sum, ligne) => {
      const prix = USE_SUPABASE 
        ? (ligne.produit_id?.prix_achat ?? 0)
        : getProduitPrixAchat(ligne.produitId);
      return sum + (ligne.quantite * prix);
    }, 0);
  }, [getEntreeLignes, getProduitPrixAchat]);

  const getFilteredPaiements = useCallback(() => {
    return (state.paiements || []).filter(p => {
      const fId = p.fournisseur_id ?? p.fournisseurId;
      return fId === supplierId;
    });
  }, [state.paiements, supplierId]);

  const calculateTotalDue = useCallback(() => {
    const entrees = getFournisseurEntrees();
    return entrees
      .filter(e => !e.paye)
      .reduce((sum, e) => sum + calculateEntreeValue(e), 0);
  }, [getFournisseurEntrees, calculateEntreeValue]);

  const calculateTotalPaye = useCallback(() => {
    const paiements = getFilteredPaiements();
    return paiements.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
  }, [getFilteredPaiements]);

  // Charger les détails d'une entrée (Supabase)
  const fetchEntreeDetails = async (entreeId) => {
    if (!USE_SUPABASE) return;
    if (entreesDetails[entreeId]) return;
    if (loadingDetails[entreeId]) return;

    setLoadingDetails(prev => ({ ...prev, [entreeId]: true }));
    try {
      const lignes = await dataCtx?.fetchEntreeDetails?.(entreeId);
      setEntreesDetails(prev => ({ ...prev, [entreeId]: lignes || [] }));
    } catch (e) {
      console.error('Erreur chargement détails entrée:', e);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [entreeId]: false }));
    }
  };

  const toggleEntreeDetails = (entreeId) => {
    const isExpanding = !expandedEntrees[entreeId];
    setExpandedEntrees(prev => ({ ...prev, [entreeId]: isExpanding }));
    if (isExpanding && USE_SUPABASE) {
      fetchEntreeDetails(entreeId);
    }
  };

  const handleAddPaiement = async () => {
    if (!paiementData.montant || !paiementData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    try {
      const payload = {
        fournisseur_id: supplierId,
        montant: parseFloat(paiementData.montant),
        date: paiementData.date,
        description: paiementData.description || ''
      };

      if (USE_SUPABASE) {
        await dataCtx?.addPaiement?.(payload);
      }

      toast({
        title: "Succès",
        description: "Paiement enregistré avec succès",
      });

      setPaiementData({
        fournisseurId: supplierId,
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowPaiementModal(false);
    } catch (e) {
      console.error('Erreur handleAddPaiement:', e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur lors de l\'ajout du paiement',
      });
    }
  };

  const handleDeletePaiement = async (paiementId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    try {
      if (USE_SUPABASE) {
        await dataCtx?.deletePaiement?.(paiementId);
      }

      toast({
        title: "Succès",
        description: "Paiement supprimé avec succès",
      });
    } catch (e) {
      console.error('Erreur handleDeletePaiement:', e);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur lors de la suppression',
      });
    }
  };

  // Charger toutes les données au montage du composant
  useEffect(() => {
    const loadAllData = async () => {
      setLoadingPage(true);
      try {
        if (USE_SUPABASE) {
          // Charger les détails de toutes les entrées du fournisseur
          const entrees = (state.entrees || []).filter(e => {
            const fId = e.fournisseur_id ?? e.fournisseurId;
            return fId === supplierId;
          });
          
          const detailsPromises = entrees.map(async (entree) => {
            const lignes = await dataCtx?.fetchEntreeDetails?.(entree.id);
            return { id: entree.id, lignes: lignes || [] };
          });
          
          const results = await Promise.all(detailsPromises);
          const newDetails = {};
          results.forEach(result => {
            if (result) {
              newDetails[result.id] = result.lignes;
            }
          });
          
          setEntreesDetails(newDetails);
        }
      } catch (error) {
        console.error('Erreur chargement données fournisseur:', error);
      } finally {
        setLoadingPage(false);
      }
    };

    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const entrees = getFournisseurEntrees();
  const paiements = getFilteredPaiements();
  const totalDue = calculateTotalDue();
  const totalPaye = calculateTotalPaye();
  const reste = totalDue - totalPaye;
  const entreesPayees = entrees.filter(e => e.paye).length;
  const entreesNonPayees = entrees.filter(e => !e.paye).length;
  const totalMarchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <Button onClick={onBack} variant="outline" size="lg">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à la liste
      </Button>

      {/* Indicateur de chargement */}
      {loadingPage && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des données...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* En-tête du fournisseur */}
      <Card className="overflow-hidden border-2 border-primary">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-3xl text-primary-foreground mb-2">{fournisseur.nom}</CardTitle>
                <CardDescription className="text-primary-foreground/90">
                  <div className="flex flex-col gap-1.5">
                    {fournisseur.contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="font-medium">{fournisseur.contact}</span>
                      </div>
                    )}
                    {fournisseur.adresse && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="font-medium">{fournisseur.adresse}</span>
                      </div>
                    )}
                  </div>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Entrées totales</p>
                <p className="text-2xl font-bold">{entrees.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entreesPayees} payées / {entreesNonPayees} non payées
                </p>
              </div>
              <Package className="h-10 w-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Paiements</p>
                <p className="text-2xl font-bold">{paiements.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Transactions</p>
              </div>
              <CreditCard className="h-10 w-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Marchandise totale</p>
                <p className="text-2xl font-bold">{totalMarchandise.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">Valeur reçue</p>
              </div>
              <DollarSign className="h-10 w-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm mb-1 ${reste > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {reste > 0 ? 'À payer' : 'Crédit'}
                </p>
                <p className={`text-2xl font-bold ${reste > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                  {Math.abs(reste).toFixed(2)} DA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reste > 0 ? 'En attente' : 'Surpayé'}
                </p>
              </div>
              {reste > 0 ? (
                <TrendingDown className="h-10 w-10 text-orange-500/30" />
              ) : (
                <TrendingUp className="h-10 w-10 text-blue-500/30" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résumé financier */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Financier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Dû</p>
                <p className="text-3xl font-bold text-destructive">{totalDue.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">{entreesNonPayees} entrée{entreesNonPayees !== 1 ? 's' : ''} non payée{entreesNonPayees !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Payé</p>
                <p className="text-3xl font-bold text-green-600">{totalPaye.toFixed(2)} DA</p>
                <p className="text-xs text-muted-foreground mt-1">{paiements.length} paiement{paiements.length !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            <Card className={reste > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}>
              <CardContent className="pt-6 text-center">
                <p className={`text-xs mb-1 ${reste > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {reste > 0 ? 'Reste à Payer' : 'Solde Positif'}
                </p>
                <p className={`text-3xl font-bold ${reste > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                  {Math.abs(reste).toFixed(2)} DA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reste > 0 ? 'En dette' : 'À jour'}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Entrées de stock */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Entrées de Stock ({entrees.length})
            </CardTitle>
            {entrees.length > 0 && (
              <Badge variant="secondary" className="text-base px-3 py-1">
                {totalMarchandise.toFixed(2)} DA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {entrees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Aucune entrée enregistrée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entrees.map((entree) => {
                const entreeValue = calculateEntreeValue(entree);
                const lignes = getEntreeLignes(entree);
                const isExpanded = expandedEntrees[entree.id];
                const isLoading = loadingDetails[entree.id];

                return (
                  <Card key={entree.id} className={`border-l-4 ${entree.paye ? 'border-l-green-500' : 'border-l-orange-500'}`}>
                    <CardContent className="p-4">
                      <button
                        onClick={() => toggleEntreeDetails(entree.id)}
                        className="w-full text-left"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{entree.date}</span>
                              <Badge variant="outline" className="text-xs">
                                ID: {entree.id?.substring(0, 8)}
                              </Badge>
                            </div>

                            {lignes.length > 0 && (
                              <p className="text-sm text-muted-foreground mb-1">
                                Produits ({lignes.length}): {lignes.map(l => {
                                  if (USE_SUPABASE) {
                                    return l.produit_id?.nom || 'Inconnu';
                                  }
                                  const p = state.produits.find(pr => pr.id === l.produitId);
                                  return p?.nom || 'Inconnu';
                                }).join(', ')}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm">
                              <span>Total de l'entrée: <strong>{entreeValue.toFixed(2)} DA</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={entree.paye ? 'bg-green-600' : 'bg-orange-600'}>
                              {entree.paye ? 'Payé' : `Non Payé: ${entreeValue.toFixed(2)} DA`}
                            </Badge>
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          {isLoading ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
                          ) : lignes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Aucune ligne</p>
                          ) : (
                            lignes.map((ligne, idx) => {
                              let produitNom, quantite, prix;
                              if (USE_SUPABASE) {
                                produitNom = ligne.produit_id?.nom || 'Inconnu';
                                quantite = ligne.quantite || 0;
                                prix = ligne.produit_id?.prix_achat || 0;
                              } else {
                                const p = state.produits.find(pr => pr.id === ligne.produitId);
                                produitNom = p?.nom || 'Inconnu';
                                quantite = ligne.quantite || 0;
                                prix = getProduitPrixAchat(ligne.produitId);
                              }
                              const sousTotal = quantite * prix;

                              return (
                                <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                                  <div>
                                    <p className="font-medium text-sm">{produitNom}</p>
                                    <p className="text-xs text-muted-foreground">Qté: {quantite} × {prix.toFixed(2)} DA</p>
                                  </div>
                                  <p className="font-bold">{sousTotal.toFixed(2)} DA</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {entreesNonPayees > 0 && (
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Reste à Payer:</span>
                      <span className="text-2xl font-bold text-orange-700">{totalDue.toFixed(2)} DA</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des paiements */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Historique des Paiements ({paiements.length})
            </CardTitle>
            {isAdmin() && (
              <Button onClick={() => setShowPaiementModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un paiement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {paiements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Aucun paiement enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paiements.map((paiement) => (
                <Card key={paiement.id} className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{paiement.date}</span>
                        </div>
                        {paiement.description && (
                          <p className="text-sm text-muted-foreground">{paiement.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-lg px-3 py-1">
                          {parseFloat(paiement.montant).toFixed(2)} DA
                        </Badge>
                        {isAdmin() && (
                          <Button
                            onClick={() => handleDeletePaiement(paiement.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Paiement */}
      <Dialog open={showPaiementModal} onOpenChange={setShowPaiementModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un Paiement</DialogTitle>
            <DialogDescription>
              Ajouter un paiement pour {fournisseur.nom}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Montant (DA) *</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 50000"
                value={paiementData.montant}
                onChange={(e) => setPaiementData({ ...paiementData, montant: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date *</label>
              <Input
                type="date"
                value={paiementData.date}
                onChange={(e) => setPaiementData({ ...paiementData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optionnel)</label>
              <Input
                type="text"
                placeholder="Ex: Paiement partiel..."
                value={paiementData.description}
                onChange={(e) => setPaiementData({ ...paiementData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaiementModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddPaiement}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierDetail;

