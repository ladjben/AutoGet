/**
 * Détail fournisseur — présentation uniquement.
 * Formules, exclusion en_attente, qté reçues, fetchEntreeDetails,
 * paiements et permissions inchangés. Pas de filtres période (aucun existant).
 */
import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Package,
  Calendar,
  Trash2,
  Phone,
  MapPin,
  ChevronRight,
  ChevronDown,
  Plus,
  AlertTriangle,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

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

  const isEntreeComptable = useCallback((entree) => {
    if (!USE_SUPABASE) return true;
    return entree.statut !== 'en_attente';
  }, []);

  const getLigneQteRecue = (ligne) => {
    if (ligne.qte_recue != null) return parseInt(ligne.qte_recue, 10) || 0;
    if (ligne.quantite_recue != null) return parseInt(ligne.quantite_recue, 10) || 0;
    return parseInt(ligne.quantite, 10) || 0;
  };

  const calculateEntreeValue = useCallback((entree) => {
    if (USE_SUPABASE && !isEntreeComptable(entree)) return 0;

    const lignes = getEntreeLignes(entree);
    return lignes.reduce((sum, ligne) => {
      const prix = USE_SUPABASE
        ? (ligne.prix_achat ?? ligne.produit_id?.prix_achat ?? 0)
        : getProduitPrixAchat(ligne.produitId);
      const qte = USE_SUPABASE ? getLigneQteRecue(ligne) : (ligne.quantite || 0);
      return sum + qte * prix;
    }, 0);
  }, [getEntreeLignes, getProduitPrixAchat, isEntreeComptable]);

  const getFilteredPaiements = useCallback(() => {
    return (state.paiements || []).filter(p => {
      const fId = p.fournisseur_id ?? p.fournisseurId;
      return fId === supplierId;
    });
  }, [state.paiements, supplierId]);

  const calculateTotalDue = useCallback(() => {
    const entrees = getFournisseurEntrees();
    return entrees
      .filter((e) => !e.paye && isEntreeComptable(e))
      .reduce((sum, e) => sum + calculateEntreeValue(e), 0);
  }, [getFournisseurEntrees, calculateEntreeValue, isEntreeComptable]);

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

  if (!fournisseur) {
    return (
      <PageSurface className="space-y-6">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la liste
        </Button>
        <PageHeader
          eyebrow="Inventaire"
          title="Fournisseur"
          description="Fiche introuvable."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Fournisseur non trouvé</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ce fournisseur n’existe pas ou n’est plus accessible.
          </p>
        </div>
      </PageSurface>
    );
  }

  const entrees = getFournisseurEntrees();
  const paiements = getFilteredPaiements();
  const totalDue = calculateTotalDue();
  const totalPaye = calculateTotalPaye();
  const reste = totalDue - totalPaye;
  const entreesPayees = entrees.filter(e => e.paye).length;
  const entreesNonPayees = entrees.filter(e => !e.paye).length;
  const totalMarchandise = entrees.reduce((sum, e) => sum + calculateEntreeValue(e), 0);

  // Affichage uniquement — mêmes helpers qté / exclusion en_attente
  const totalQteRecues = entrees.reduce((sum, entree) => {
    if (!isEntreeComptable(entree)) return sum;
    const lignes = getEntreeLignes(entree);
    return sum + lignes.reduce((s, ligne) => s + getLigneQteRecue(ligne), 0);
  }, 0);

  const isDisabled = Boolean(fournisseur.deleted_at);
  const hasDebt = reste > 0;
  const isCredit = reste < 0;

  const renderPayeBadge = (paye, amount) =>
    paye ? (
      <StatusBadge status="paye" />
    ) : (
      <StatusBadge
        status="litige"
        label={amount != null ? `Non payé · ${formatDa(amount)}` : 'Non payé'}
      />
    );

  const renderStatutBadge = (statut) => {
    if (!statut) return null;
    if (statut === 'en_attente') return <StatusBadge status="en_attente" />;
    if (statut === 'litige') return <StatusBadge status="litige" />;
    if (statut === 'valide') return <StatusBadge status="valide" label="Validé" />;
    return <StatusBadge status="info" label={statut} />;
  };

  const renderLignesDetail = (entree) => {
    const lignes = getEntreeLignes(entree);
    const isLoading = loadingDetails[entree.id];

    if (isLoading) {
      return (
        <p className="py-3 text-center text-sm text-muted-foreground">Chargement…</p>
      );
    }
    if (lignes.length === 0) {
      return (
        <p className="py-3 text-center text-sm text-muted-foreground">Aucune ligne</p>
      );
    }

    return (
      <div className="space-y-1.5">
        {lignes.map((ligne, idx) => {
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
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{produitNom}</p>
                <p className="text-xs text-muted-foreground">
                  Qté: {quantite} × {formatDa(prix)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatDa(sousTotal)}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <PageSurface className="space-y-6">
      <Button onClick={onBack} variant="outline" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à la liste
      </Button>

      <PageHeader
        eyebrow="Inventaire"
        title={fournisseur.nom}
        description="Compte fournisseur — entrées, paiements et solde."
        actions={
          isAdmin() ? (
            <Button size="sm" onClick={() => setShowPaiementModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un paiement
            </Button>
          ) : null
        }
      />

      {/* Identité */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-semibold tracking-tight">
                {fournisseur.nom}
              </p>
              {isDisabled && <StatusBadge status="litige" label="Désactivé" />}
              {!hasDebt && !isCredit && <StatusBadge status="paye" label="Soldé" />}
              {hasDebt && <StatusBadge status="en_attente" label="À payer" />}
              {isCredit && <StatusBadge status="info" label="Crédit" />}
            </div>
            {fournisseur.contact ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {fournisseur.contact}
              </p>
            ) : null}
            {fournisseur.adresse ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {fournisseur.adresse}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {loadingPage && (
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
          Chargement des données…
        </div>
      )}

      {/* KPI financiers prioritaires */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Total dû" value={formatDa(totalDue)} tone="danger" />
        <MetaStat label="Total payé" value={formatDa(totalPaye)} tone="success" />
        <MetaStat
          label={hasDebt ? 'Reste à payer' : isCredit ? 'Crédit' : 'Reste'}
          value={formatDa(Math.abs(reste))}
          tone={hasDebt ? 'warning' : isCredit ? 'info' : 'success'}
        />
        <MetaStat label="Marchandise" value={formatDa(totalMarchandise)} />
      </div>

      {/* Indicateurs opérationnels */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-4">
        <MetaStat
          label="Entrées"
          value={`${formatNum(entrees.length)} · ${formatNum(entreesPayees)} payées / ${formatNum(entreesNonPayees)} non`}
        />
        <MetaStat label="Paiements" value={formatNum(paiements.length)} />
        <MetaStat label="Qté reçues" value={formatNum(totalQteRecues)} />
        <MetaStat
          label="Non payées"
          value={formatNum(entreesNonPayees)}
          tone={entreesNonPayees > 0 ? 'warning' : undefined}
        />
      </div>

      {/* Historique des entrées */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Historique des entrées
            </h2>
            <p className="text-xs text-muted-foreground">
              {formatNum(entrees.length)} entrée(s)
              {entrees.length > 0 ? ` · ${formatDa(totalMarchandise)}` : ''}
            </p>
          </div>
        </div>

        {entrees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucune entrée enregistrée</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les entrées de stock de ce fournisseur apparaîtront ici.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Réf.</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="px-3 py-2.5 font-medium">Paiement</th>
                    <th className="px-3 py-2.5 text-right font-medium">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {entrees.map((entree) => {
                    const entreeValue = calculateEntreeValue(entree);
                    const isExpanded = expandedEntrees[entree.id];
                    const lignes = getEntreeLignes(entree);

                    return (
                      <Fragment key={entree.id}>
                        <tr
                          className={cn(
                            'border-b border-border/40 hover:bg-muted/20',
                            !entree.paye && 'bg-[hsl(var(--warning)/0.03)]'
                          )}
                        >
                          <td className="px-2 py-2.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleEntreeDetails(entree.id)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Replier' : 'Développer'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatDate(entree.date)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {entree.id?.substring(0, 8) || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {renderStatutBadge(entree.statut) || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {renderPayeBadge(entree.paye)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {formatDa(entreeValue)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/40 bg-muted/10">
                            <td colSpan={6} className="px-4 py-3">
                              <p className="mb-2 text-xs text-muted-foreground">
                                Lignes ({lignes.length})
                                {lignes.length > 0
                                  ? ` — ${lignes
                                      .map((l) =>
                                        USE_SUPABASE
                                          ? l.produit_id?.nom || 'Inconnu'
                                          : state.produits.find((pr) => pr.id === l.produitId)
                                              ?.nom || 'Inconnu'
                                      )
                                      .join(', ')}`
                                  : ''}
                              </p>
                              {renderLignesDetail(entree)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {entrees.map((entree) => {
                const entreeValue = calculateEntreeValue(entree);
                const isExpanded = expandedEntrees[entree.id];
                const lignes = getEntreeLignes(entree);

                return (
                  <div
                    key={entree.id}
                    className={cn(
                      'rounded-lg border border-border/80 bg-card',
                      !entree.paye && 'border-[hsl(var(--warning)/0.35)]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleEntreeDetails(entree.id)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(entree.date)}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {entree.id?.substring(0, 8)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {renderStatutBadge(entree.statut)}
                          {renderPayeBadge(entree.paye)}
                        </div>
                        {lignes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {lignes.length} produit{lignes.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatDa(entreeValue)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/50 px-3 py-3">
                        {renderLignesDetail(entree)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {entreesNonPayees > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.08)] px-4 py-3">
                <span className="text-sm font-medium">Reste à payer</span>
                <span className="text-lg font-bold tabular-nums text-[hsl(var(--warning))]">
                  {formatDa(totalDue)}
                </span>
              </div>
            )}
          </>
        )}
      </section>

      <Separator className="opacity-60" />

      {/* Historique des paiements */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Historique des paiements
            </h2>
            <p className="text-xs text-muted-foreground">
              {formatNum(paiements.length)} paiement(s)
              {paiements.length > 0 ? ` · ${formatDa(totalPaye)}` : ''}
            </p>
          </div>
          {isAdmin() && (
            <Button size="sm" variant="outline" onClick={() => setShowPaiementModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un paiement
            </Button>
          )}
        </div>

        {paiements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun paiement enregistré</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les paiements versés à ce fournisseur apparaîtront ici.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                    {isAdmin() && (
                      <th className="w-12 px-3 py-2.5 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((paiement) => (
                    <tr
                      key={paiement.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDate(paiement.date)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {paiement.description || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-success">
                        {formatDa(paiement.montant)}
                      </td>
                      {isAdmin() && (
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            type="button"
                            onClick={() => handleDeletePaiement(paiement.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Supprimer le paiement"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {paiements.map((paiement) => (
                <div
                  key={paiement.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(paiement.date)}
                    </p>
                    {paiement.description ? (
                      <p className="text-xs text-muted-foreground">{paiement.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-success">
                      {formatDa(paiement.montant)}
                    </span>
                    {isAdmin() && (
                      <Button
                        type="button"
                        onClick={() => handleDeletePaiement(paiement.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Supprimer le paiement"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Modal Paiement — logique inchangée */}
      <Dialog open={showPaiementModal} onOpenChange={setShowPaiementModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              Ajouter un paiement pour {fournisseur.nom}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sd-montant">
                Montant (DA) *
              </label>
              <Input
                id="sd-montant"
                type="number"
                step="0.01"
                placeholder="Ex: 50000"
                value={paiementData.montant}
                onChange={(e) => setPaiementData({ ...paiementData, montant: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sd-date">
                Date *
              </label>
              <Input
                id="sd-date"
                type="date"
                value={paiementData.date}
                onChange={(e) => setPaiementData({ ...paiementData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sd-desc">
                Description (optionnel)
              </label>
              <Input
                id="sd-desc"
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
    </PageSurface>
  );
};

export default SupplierDetail;
