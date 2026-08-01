/**
 * Fournisseurs — liste (présentation uniquement).
 * Formules financières, filtres période, v_entree_lignes_detail,
 * CRUD fournisseurs/paiements et permissions inchangés.
 * SupplierDetail non modifié.
 */
import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Plus,
  Building2,
  CreditCard,
  Trash2,
  Phone,
  MoreHorizontal,
  Search,
  ChevronRight,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import SupplierDetail from './SupplierDetail';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-[hsl(var(--warning))]',
          tone === 'info' && 'text-[hsl(var(--info))]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MoneyCell({ value, tone }) {
  const n = parseFloat(value) || 0;
  return (
    <span
      className={cn(
        'tabular-nums font-semibold',
        tone === 'danger' && n > 0 && 'text-danger',
        tone === 'success' && n > 0 && 'text-success',
        tone === 'warning' && n > 0 && 'text-[hsl(var(--warning))]',
        tone === 'info' && n !== 0 && 'text-[hsl(var(--info))]'
      )}
    >
      {formatDa(n)}
    </span>
  );
}

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

  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [entreesDetails, setEntreesDetails] = useState({}); // { entreeId: lignes[] }
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
  const getProduitPrixAchat = useCallback((produitId, ligne = null) => {
    if (ligne?.prix_achat != null) {
      return parseFloat(ligne.prix_achat) || 0;
    }
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

  const isEntreeComptable = useCallback((entree) => {
    if (!USE_SUPABASE) return true;
    return entree.statut !== 'en_attente';
  }, []);

  const getLigneQteRecue = (ligne) => {
    if (ligne.qte_recue != null) return parseInt(ligne.qte_recue, 10) || 0;
    if (ligne.quantite_recue != null) return parseInt(ligne.quantite_recue, 10) || 0;
    return parseInt(ligne.quantite, 10) || 0;
  };

  // Calculer la valeur d'une entrée (quantité reçue uniquement, hors en_attente)
  const calculateEntreeValue = useCallback((entree) => {
    if (USE_SUPABASE && !isEntreeComptable(entree)) return 0;

    if (!USE_SUPABASE && entree.lignes) {
      return entree.lignes.reduce((sum, ligne) => {
        return sum + (ligne.quantite || 0) * getProduitPrixAchat(ligne.produitId);
      }, 0);
    }

    if (USE_SUPABASE && entreesDetails[entree.id]) {
      return entreesDetails[entree.id].reduce((sum, ligne) => {
        const prix = getProduitPrixAchat(ligne.produit_id, ligne);
        return sum + getLigneQteRecue(ligne) * prix;
      }, 0);
    }

    return 0;
  }, [getProduitPrixAchat, entreesDetails, isEntreeComptable]);

  const calculateTotalDue = useCallback((fournisseurId) => {
    let total = 0;
    const entrees = getFournisseurEntrees(fournisseurId);

    entrees.forEach((entree) => {
      if (!entree.paye && isEntreeComptable(entree)) {
        total += calculateEntreeValue(entree);
      }
    });
    return total;
  }, [getFournisseurEntrees, calculateEntreeValue, isEntreeComptable]);

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
      
      // Compter les produits reçus (hors envois en attente)
      entrees.forEach((entree) => {
        if (!isEntreeComptable(entree)) return;
        const lignes = getEntreeLignes(entree);
        totalProduitsReçus += lignes.reduce((sum, ligne) => sum + getLigneQteRecue(ligne), 0);
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
    getEntreeLignes,
    isEntreeComptable
  ]);

  // Charger toutes les lignes d'entrée en une seule requête (vue agrégée)
  useEffect(() => {
    if (!USE_SUPABASE || !dataCtx?.supabase) return;

    const loadAllEntreesDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        let allRows = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error, count } = await dataCtx.supabase
            .from('v_entree_lignes_detail')
            .select('entree_id, statut, produit_id, prix_achat, qte_envoyee, qte_recue', { count: 'exact' })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            page++;
            hasMore = data.length === pageSize && (count === null || allRows.length < count);
          } else {
            hasMore = false;
          }
        }

        const details = {};
        for (const row of allRows) {
          const entreeId = row.entree_id;
          if (!details[entreeId]) details[entreeId] = [];
          details[entreeId].push({
            produit_id: row.produit_id,
            prix_achat: row.prix_achat,
            qte_recue: row.qte_recue,
          });
        }
        setEntreesDetails(details);
      } catch (e) {
        console.error('Erreur chargement lignes détail:', e);
        setEntreesDetails({});
        setDetailsError(e?.message || 'Erreur de chargement des lignes');
      } finally {
        setDetailsLoading(false);
      }
    };

    loadAllEntreesDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        if (!dataCtx?.deleteFournisseur) {
          throw new Error('Fonction deleteFournisseur non disponible');
        }
        await dataCtx.deleteFournisseur(id);

        toast({
          title: "Succès",
          description: "Fournisseur supprimé (historique conservé)",
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

  // Helpers / handlers métier conservés (parité avant redesign ; utilisés hors rendu liste)
  void getProduitName;
  void getFournisseurName;
  void handleDeletePaiement;

  // Recherche présentationnelle — n’altère pas globalTotals ni les filtres période
  const displayedFournisseurs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredFournisseurs;
    return filteredFournisseurs.filter((f) => {
      const nom = (f.nom || '').toLowerCase();
      const contact = (f.contact || '').toLowerCase();
      const adresse = (f.adresse || '').toLowerCase();
      return nom.includes(q) || contact.includes(q) || adresse.includes(q);
    });
  }, [filteredFournisseurs, searchQuery]);

  const hasActiveFilters =
    Boolean(filters.fournisseurId || filters.dateStart || filters.dateEnd) ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setFilters({ fournisseurId: '', dateStart: '', dateEnd: '' });
    setSearchQuery('');
  };

  // Masquer toute la section pour les utilisateurs non-admin
  if (!isAdmin()) {
    return (
      <PageSurface>
        <PageHeader
          eyebrow="Inventaire"
          title="Fournisseurs"
          description="Accès réservé aux administrateurs."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Accès restreint</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vous devez être administrateur pour accéder à la gestion des fournisseurs.
          </p>
        </div>
      </PageSurface>
    );
  }

  const paiementDialog = (
    <Dialog open={showPaiementModal} onOpenChange={setShowPaiementModal}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="mr-2 h-4 w-4" />
          Nouveau paiement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau paiement</DialogTitle>
          <DialogDescription>
            Enregistrez un nouveau paiement pour un fournisseur
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sp-fournisseur">
              Fournisseur *
            </label>
            <select
              id="sp-fournisseur"
              value={paiementData.fournisseurId}
              onChange={(e) => setPaiementData({ ...paiementData, fournisseurId: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <label className="mb-2 block text-sm font-medium" htmlFor="sp-montant">
              Montant (DA) *
            </label>
            <Input
              id="sp-montant"
              type="number"
              step="0.01"
              value={paiementData.montant}
              onChange={(e) => setPaiementData({ ...paiementData, montant: e.target.value })}
            />
          </div>

          {paiementData.fournisseurId && (
            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-3">
              {(() => {
                const currentTotalDue = calculateTotalDue(paiementData.fournisseurId);
                const currentTotalPaye = calculateTotalPaye(paiementData.fournisseurId);
                const restantActuel = currentTotalDue - currentTotalPaye;
                const montantPaiement = parseFloat(paiementData.montant) || 0;
                const nouveauReste = restantActuel - montantPaiement;

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Reste actuel</span>
                      <span className="font-semibold tabular-nums text-[hsl(var(--warning))]">
                        {formatDa(restantActuel)}
                      </span>
                    </div>
                    {montantPaiement > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Paiement</span>
                          <span className="font-semibold tabular-nums text-success">
                            −{formatDa(montantPaiement)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-semibold">Nouveau reste</span>
                          <span
                            className={cn(
                              'text-lg font-bold tabular-nums',
                              nouveauReste > 0 ? 'text-[hsl(var(--warning))]' : 'text-success'
                            )}
                          >
                            {formatDa(nouveauReste)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sp-date">
              Date *
            </label>
            <Input
              id="sp-date"
              type="date"
              value={paiementData.date}
              onChange={(e) => setPaiementData({ ...paiementData, date: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sp-desc">
              Description
            </label>
            <Textarea
              id="sp-desc"
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
          <Button onClick={handleAddPaiement}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const fournisseurDialog = (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau fournisseur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau fournisseur</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau fournisseur à votre base de données
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sf-nom">
              Nom *
            </label>
            <Input
              id="sf-nom"
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sf-contact">
              Contact
            </label>
            <Input
              id="sf-contact"
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sf-adresse">
              Adresse
            </label>
            <Textarea
              id="sf-adresse"
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
          <Button onClick={handleAddFournisseur}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Inventaire"
        title="Fournisseurs"
        description="Soldes, marchandise et paiements — vue financière consolidée."
        actions={
          <>
            {paiementDialog}
            {fournisseurDialog}
          </>
        }
      />

      {/* KPI prioritaires */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat
          label="Total dû"
          value={formatDa(globalTotals.totalDue)}
          tone="danger"
        />
        <MetaStat
          label="Total payé"
          value={formatDa(globalTotals.totalPaye)}
          tone="success"
        />
        <MetaStat
          label={globalTotals.reste > 0 ? 'Reste' : globalTotals.reste < 0 ? 'Crédit' : 'Reste'}
          value={formatDa(Math.abs(globalTotals.reste))}
          tone={globalTotals.reste > 0 ? 'warning' : globalTotals.reste < 0 ? 'info' : 'success'}
        />
        <MetaStat
          label="Marchandise"
          value={formatDa(globalTotals.totalMarchandise)}
        />
      </div>

      {/* Indicateurs secondaires */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetaStat label="Fournisseurs" value={formatNum(filteredFournisseurs.length)} />
        <MetaStat
          label="Entrées"
          value={`${formatNum(globalTotals.totalEntrees)} · ${formatNum(globalTotals.totalEntreesPayees)} payées / ${formatNum(globalTotals.totalEntreesNonPayees)} non`}
        />
        <MetaStat label="Paiements" value={formatNum(globalTotals.totalPaiements)} />
        <MetaStat
          label="Qté reçues"
          value={formatNum(globalTotals.totalProduitsReçus)}
        />
        <MetaStat
          label="Avec dettes"
          value={formatNum(globalTotals.fournisseursAvecDettes)}
          tone="warning"
        />
      </div>

      {/* Recherche + filtres */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sup-search">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sup-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, contact ou adresse…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sup-f">
            Fournisseur
          </label>
          <select
            id="sup-f"
            value={filters.fournisseurId}
            onChange={(e) => setFilters({ ...filters, fournisseurId: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Tous</option>
            {(state.fournisseurs || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sup-ds">
            Date début
          </label>
          <Input
            id="sup-ds"
            type="date"
            value={filters.dateStart}
            onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sup-de">
            Date fin
          </label>
          <Input
            id="sup-de"
            type="date"
            value={filters.dateEnd}
            onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
            className="h-9"
          />
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </section>

      {detailsError && (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger)/0.08)] px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">Erreur de chargement des lignes</p>
            <p className="text-xs text-muted-foreground">{detailsError}</p>
          </div>
        </div>
      )}

      {/* Liste */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Liste des fournisseurs
          </h2>
          <p className="text-xs text-muted-foreground">
            {detailsLoading
              ? 'Chargement des lignes de marchandise…'
              : `${formatNum(displayedFournisseurs.length)} fournisseur(s)${
                  hasActiveFilters ? ' (filtrés)' : ''
                }`}
          </p>
        </div>

        {detailsLoading && (state.fournisseurs || []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
            Chargement des fournisseurs…
          </div>
        ) : displayedFournisseurs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">
              {(state.fournisseurs || []).length === 0
                ? 'Aucun fournisseur'
                : 'Aucun résultat'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'Modifiez ou réinitialisez les filtres.'
                : 'Créez un fournisseur pour commencer.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Fournisseur</th>
                    <th className="px-3 py-2.5 font-medium">Contact</th>
                    <th className="px-3 py-2.5 text-right font-medium">Marchandise</th>
                    <th className="px-3 py-2.5 text-right font-medium">Dû</th>
                    <th className="px-3 py-2.5 text-right font-medium">Payé</th>
                    <th className="px-3 py-2.5 text-right font-medium">Reste</th>
                    <th className="w-12 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedFournisseurs.map((fournisseur) => {
                    const totalDue = calculateTotalDue(fournisseur.id);
                    const totalPaye = calculateTotalPaye(fournisseur.id);
                    const reste = totalDue - totalPaye;
                    const entrees = getFournisseurEntrees(fournisseur.id);
                    const totalMarchandise = entrees.reduce(
                      (sum, e) => sum + calculateEntreeValue(e),
                      0
                    );
                    const isDisabled = Boolean(fournisseur.deleted_at);
                    const isCredit = reste < 0;
                    const hasDebt = reste > 0;

                    return (
                      <tr
                        key={fournisseur.id}
                        className={cn(
                          'border-b border-border/40 last:border-0 hover:bg-muted/20',
                          isDisabled && 'opacity-60',
                          hasDebt && 'bg-[hsl(var(--warning)/0.03)]'
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left font-medium hover:underline"
                            onClick={() => onSelectSupplier(fournisseur.id)}
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{fournisseur.nom}</span>
                          </button>
                          {isDisabled && (
                            <div className="mt-1">
                              <StatusBadge status="litige" label="Désactivé" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {fournisseur.contact || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatDa(totalMarchandise)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <MoneyCell value={totalDue} tone="danger" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <MoneyCell value={totalPaye} tone="success" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <MoneyCell
                              value={Math.abs(reste)}
                              tone={hasDebt ? 'warning' : isCredit ? 'info' : undefined}
                            />
                            {isCredit && (
                              <span className="text-[10px] font-medium text-[hsl(var(--info))]">
                                Crédit
                              </span>
                            )}
                            {hasDebt && (
                              <span className="text-[10px] font-medium text-[hsl(var(--warning))]">
                                À payer
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => onSelectSupplier(fournisseur.id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Ouvrir le détail
                              </DropdownMenuItem>
                              {isAdmin() && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteFournisseur(fournisseur.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {displayedFournisseurs.map((fournisseur) => {
                const totalDue = calculateTotalDue(fournisseur.id);
                const totalPaye = calculateTotalPaye(fournisseur.id);
                const reste = totalDue - totalPaye;
                const entrees = getFournisseurEntrees(fournisseur.id);
                const paiements = getFilteredPaiements(fournisseur.id);
                const totalMarchandise = entrees.reduce(
                  (sum, e) => sum + calculateEntreeValue(e),
                  0
                );
                const isDisabled = Boolean(fournisseur.deleted_at);
                const isCredit = reste < 0;
                const hasDebt = reste > 0;

                return (
                  <button
                    type="button"
                    key={fournisseur.id}
                    onClick={() => onSelectSupplier(fournisseur.id)}
                    className={cn(
                      'w-full rounded-lg border border-border/80 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/20',
                      isDisabled && 'opacity-60',
                      hasDebt && 'border-[hsl(var(--warning)/0.35)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{fournisseur.nom}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </p>
                        {fournisseur.contact ? (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {fournisseur.contact}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {entrees.length} entrée{entrees.length !== 1 ? 's' : ''}
                          {' · '}
                          {paiements.length} paiement{paiements.length !== 1 ? 's' : ''}
                        </p>
                        {isDisabled && <StatusBadge status="litige" label="Désactivé" />}
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            hasDebt && 'text-[hsl(var(--warning))]',
                            isCredit && 'text-[hsl(var(--info))]'
                          )}
                        >
                          {formatDa(Math.abs(reste))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasDebt ? 'À payer' : isCredit ? 'Crédit' : 'Soldé'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Marchandise</p>
                        <p className="text-xs font-medium tabular-nums">
                          {formatDa(totalMarchandise)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Dû</p>
                        <p className="text-xs font-medium tabular-nums text-danger">
                          {formatDa(totalDue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Payé</p>
                        <p className="text-xs font-medium tabular-nums text-success">
                          {formatDa(totalPaye)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </PageSurface>
  );
};

export default Suppliers;
