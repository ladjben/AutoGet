/**
 * Entrées validées — présentation uniquement.
 * fetchEntreesValidees, CRUD lignes, calcValeurTotale, permissions inchangés.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  MoreHorizontal,
  Search,
  AlertTriangle,
  Eye,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const calcValeurTotale = (lignes) =>
  (lignes || []).reduce(
    (sum, l) => sum + (parseInt(l.quantite_recue, 10) || 0) * (parseFloat(l.prix_achat) || 0),
    0
  );

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-[hsl(var(--warning))]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

const ValidatedEntries = () => {
  const dataCtx = useData();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [screen, setScreen] = useState('list');
  const [entrees, setEntrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEntree, setSelectedEntree] = useState(null);
  const [editLignes, setEditLignes] = useState([]);
  const [deletedLigneIds, setDeletedLigneIds] = useState([]);
  const [newLigne, setNewLigne] = useState({ produitId: '', quantite: '', quantite_recue: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPaye, setFilterPaye] = useState('');

  const produits = useMemo(() => dataCtx?.produits ?? [], [dataCtx?.produits]);

  const loadEntrees = useCallback(async () => {
    if (!dataCtx?.fetchEntreesValidees) return;
    setLoading(true);
    try {
      const data = await dataCtx.fetchEntreesValidees();
      setEntrees(data || []);
    } catch (e) {
      console.error('Erreur chargement entrées validées:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les entrées validées',
      });
    } finally {
      setLoading(false);
    }
  }, [dataCtx, toast]);

  useEffect(() => {
    if (USE_SUPABASE) {
      dataCtx?.fetchProduits?.();
      loadEntrees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (entree) => {
    setSelectedEntree(entree);
    setEditLignes(
      (entree.lignes || []).map((l) => ({
        ...l,
        _key: l.ligne_id,
        _isNew: false,
      }))
    );
    setDeletedLigneIds([]);
    setNewLigne({ produitId: '', quantite: '', quantite_recue: '' });
    setScreen('detail');
  };

  const backToList = () => {
    setScreen('list');
    setSelectedEntree(null);
    setEditLignes([]);
    setDeletedLigneIds([]);
  };

  const liveValeur = useMemo(() => calcValeurTotale(editLignes), [editLignes]);

  const handleLigneChange = (key, field, value) => {
    const parsed = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setEditLignes((prev) =>
      prev.map((l) => (l._key === key ? { ...l, [field]: parsed } : l))
    );
  };

  const handleRemoveLigne = (ligne) => {
    if (!ligne._isNew && ligne.ligne_id) {
      setDeletedLigneIds((prev) => [...prev, ligne.ligne_id]);
    }
    setEditLignes((prev) => prev.filter((l) => l._key !== ligne._key));
  };

  const requestRemoveLigne = (ligne) => {
    if (!window.confirm('Êtes-vous sûr de vouloir retirer cette ligne ?')) return;
    handleRemoveLigne(ligne);
  };

  const handleAddLigne = () => {
    if (!newLigne.produitId || newLigne.quantite === '') {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Sélectionnez un produit et une quantité envoyée',
      });
      return;
    }

    const produit = produits.find((p) => p.id === newLigne.produitId);
    const quantite = parseInt(newLigne.quantite, 10) || 0;
    const quantite_recue =
      newLigne.quantite_recue === '' ? 0 : parseInt(newLigne.quantite_recue, 10) || 0;

    if (quantite <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'La quantité envoyée doit être supérieure à 0',
      });
      return;
    }

    setEditLignes((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}-${Math.random()}`,
        _isNew: true,
        ligne_id: null,
        produit_id: newLigne.produitId,
        reference: produit?.reference || '',
        produit_nom: produit?.nom || 'Produit',
        prix_achat: parseFloat(produit?.prix_achat) || 0,
        quantite,
        quantite_recue,
      },
    ]);
    setNewLigne({ produitId: '', quantite: '', quantite_recue: '' });
  };

  const handleSave = async () => {
    if (!selectedEntree || !dataCtx) return;

    setSaving(true);
    try {
      for (const ligneId of deletedLigneIds) {
        await dataCtx.deleteEntreeLigne(ligneId);
      }

      for (const ligne of editLignes) {
        if (ligne._isNew) {
          await dataCtx.addEntreeLigne(selectedEntree.entree_id, {
            produit_id: ligne.produit_id,
            quantite: ligne.quantite,
            quantite_recue: ligne.quantite_recue,
          });
        } else if (ligne.ligne_id) {
          await dataCtx.updateEntreeLigne(ligne.ligne_id, {
            quantite: ligne.quantite,
            quantite_recue: ligne.quantite_recue,
          });
        }
      }

      await Promise.all([
        dataCtx.fetchEntrees?.(),
        loadEntrees(),
      ]);

      toast({
        title: 'Modifications enregistrées',
        description: 'Les quantités ont été mises à jour. Le montant dû sera recalculé.',
      });

      backToList();
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible d\'enregistrer les modifications',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtre présentation uniquement (données déjà chargées)
  const filteredEntrees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (entrees || []).filter((entree) => {
      if (filterStatut && entree.statut !== filterStatut) return false;
      if (filterPaye === 'paye' && !entree.paye) return false;
      if (filterPaye === 'non_paye' && entree.paye) return false;
      if (!q) return true;
      const nom = String(entree.fournisseur_nom || '').toLowerCase();
      const id = String(entree.entree_id || '').toLowerCase();
      return nom.includes(q) || id.includes(q);
    });
  }, [entrees, searchQuery, filterStatut, filterPaye]);

  // KPI dérivés des données déjà présentes + calcValeurTotale existant
  const listStats = useMemo(() => {
    const list = entrees || [];
    let litiges = 0;
    let payees = 0;
    let valeur = 0;
    list.forEach((e) => {
      if (e.statut === 'litige') litiges += 1;
      if (e.paye) payees += 1;
      valeur += calcValeurTotale(e.lignes);
    });
    return {
      total: list.length,
      litiges,
      valides: list.length - litiges,
      payees,
      nonPayees: list.length - payees,
      valeur,
    };
  }, [entrees]);

  const hasActiveFilters = Boolean(searchQuery.trim() || filterStatut || filterPaye);

  const renderStatutBadge = (statut) => {
    if (statut === 'litige') return <StatusBadge status="litige" />;
    return <StatusBadge status="valide" label="Validé" />;
  };

  const renderPayeBadge = (paye) =>
    paye ? (
      <StatusBadge status="paye" />
    ) : (
      <StatusBadge status="litige" label="Non payé" />
    );

  const lineHasEcart = (ligne) =>
    Number(ligne.quantite || 0) !== Number(ligne.quantite_recue || 0);

  if (!USE_SUPABASE) {
    return (
      <PageSurface>
        <PageHeader
          eyebrow="Inventaire"
          title="Entrées validées"
          description="Cette section nécessite Supabase."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
          Mode localStorage : les entrées validées ne sont pas disponibles.
        </div>
      </PageSurface>
    );
  }

  if (!isAdmin()) {
    return (
      <PageSurface>
        <PageHeader
          eyebrow="Inventaire"
          title="Entrées validées"
          description="Accès réservé aux administrateurs."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
          Accès restreint — réservé aux administrateurs.
        </div>
      </PageSurface>
    );
  }

  if (screen === 'detail' && selectedEntree) {
    const detailLitige = selectedEntree.statut === 'litige';
    const ecartCount = editLignes.filter(lineHasEcart).length;

    return (
      <PageSurface className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={backToList}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
          {saving ? (
            <span className="text-xs text-muted-foreground">Enregistrement en cours…</span>
          ) : null}
        </div>

        <PageHeader
          eyebrow="Détail"
          title={selectedEntree.fournisseur_nom || 'Fournisseur'}
          description={`Entrée du ${formatDate(selectedEntree.date)} · correction des quantités envoyées et reçues.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {renderStatutBadge(selectedEntree.statut)}
              {renderPayeBadge(selectedEntree.paye)}
            </div>
          }
        />

        {(detailLitige || ecartCount > 0) && (
          <div
            role="status"
            className={cn(
              'flex gap-3 rounded-lg border px-3 py-3 text-sm',
              detailLitige
                ? 'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.1)]'
                : 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.1)]'
            )}
          >
            <AlertTriangle
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                detailLitige ? 'text-danger' : 'text-[hsl(var(--warning))]'
              )}
            />
            <div>
              {detailLitige ? (
                <p className="font-medium">Entrée en litige</p>
              ) : (
                <p className="font-medium">Écarts de quantité détectés</p>
              )}
              <p className="text-xs text-muted-foreground">
                {ecartCount > 0
                  ? `${ecartCount} ligne(s) avec quantité reçue différente de la quantité envoyée.`
                  : 'Contrôlez les quantités reçues avant enregistrement.'}
              </p>
            </div>
          </div>
        )}

        {/* Infos entrée */}
        <section className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
          <MetaStat
            label="Fournisseur"
            value={selectedEntree.fournisseur_nom || '—'}
          />
          <MetaStat label="Date" value={formatDate(selectedEntree.date)} />
          <MetaStat label="Lignes" value={formatNum(editLignes.length)} />
          <MetaStat label="Valeur (qté reçue)" value={formatDa(liveValeur)} />
        </section>

        {/* Lignes */}
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Lignes de produits
            </h2>
            <p className="text-xs text-muted-foreground">
              Quantités envoyées / reçues — les écarts sont surlignés.
            </p>
          </div>

          {editLignes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune ligne — ajoutez un produit ci-dessous.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Produit</th>
                      <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                      <th className="px-3 py-2.5 text-right font-medium">Envoyée</th>
                      <th className="px-3 py-2.5 text-right font-medium">Reçue</th>
                      <th className="px-3 py-2.5 text-right font-medium">Écart</th>
                      <th className="px-3 py-2.5 text-right font-medium">Sous-total</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {editLignes.map((ligne) => {
                      const ecart =
                        Number(ligne.quantite_recue || 0) - Number(ligne.quantite || 0);
                      const hasEcart = lineHasEcart(ligne);
                      const sousTotal =
                        (ligne.quantite_recue || 0) * (ligne.prix_achat || 0);
                      return (
                        <tr
                          key={ligne._key}
                          className={cn(
                            'border-b border-border/40 last:border-0',
                            hasEcart && 'bg-[hsl(var(--warning)/0.08)]'
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <p className="font-medium">
                              {ligne.reference ? `${ligne.reference} · ` : ''}
                              {ligne.produit_nom}
                            </p>
                            {ligne._isNew ? (
                              <p className="text-[11px] text-muted-foreground">Nouvelle ligne</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatDa(ligne.prix_achat)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Input
                              type="number"
                              min="0"
                              value={ligne.quantite}
                              onChange={(e) =>
                                handleLigneChange(ligne._key, 'quantite', e.target.value)
                              }
                              className="ml-auto h-8 w-24 text-right"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <Input
                              type="number"
                              min="0"
                              value={ligne.quantite_recue}
                              onChange={(e) =>
                                handleLigneChange(ligne._key, 'quantite_recue', e.target.value)
                              }
                              className="ml-auto h-8 w-24 text-right"
                            />
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right tabular-nums font-medium',
                              hasEcart && 'text-[hsl(var(--warning))]'
                            )}
                          >
                            {hasEcart ? (ecart > 0 ? `+${ecart}` : ecart) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {formatDa(sousTotal)}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => requestRemoveLigne(ligne)}
                              aria-label="Retirer la ligne"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {editLignes.map((ligne) => {
                  const ecart =
                    Number(ligne.quantite_recue || 0) - Number(ligne.quantite || 0);
                  const hasEcart = lineHasEcart(ligne);
                  const sousTotal =
                    (ligne.quantite_recue || 0) * (ligne.prix_achat || 0);
                  return (
                    <div
                      key={ligne._key}
                      className={cn(
                        'rounded-lg border border-border/80 bg-card px-3 py-3 space-y-3',
                        hasEcart && 'border-[hsl(var(--warning)/0.5)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {ligne.reference ? `${ligne.reference} · ` : ''}
                            {ligne.produit_nom}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Prix : {formatDa(ligne.prix_achat)}
                            {hasEcart ? ` · Écart ${ecart > 0 ? `+${ecart}` : ecart}` : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => requestRemoveLigne(ligne)}
                          aria-label="Retirer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Qté envoyée</label>
                          <Input
                            type="number"
                            min="0"
                            value={ligne.quantite}
                            onChange={(e) =>
                              handleLigneChange(ligne._key, 'quantite', e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Qté reçue</label>
                          <Input
                            type="number"
                            min="0"
                            value={ligne.quantite_recue}
                            onChange={(e) =>
                              handleLigneChange(ligne._key, 'quantite_recue', e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <p className="text-sm">
                        Sous-total :{' '}
                        <span className="font-semibold tabular-nums">{formatDa(sousTotal)}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <Separator />

        {/* Ajout ligne */}
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Ajouter une ligne
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-produit">
                Produit
              </label>
              <select
                id="ve-produit"
                value={newLigne.produitId}
                onChange={(e) => setNewLigne({ ...newLigne, produitId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sélectionner…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference ? `${p.reference} · ` : ''}
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-qte">
                Qté envoyée
              </label>
              <Input
                id="ve-qte"
                type="number"
                min="1"
                value={newLigne.quantite}
                onChange={(e) => setNewLigne({ ...newLigne, quantite: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-qte-r">
                Qté reçue
              </label>
              <Input
                id="ve-qte-r"
                type="number"
                min="0"
                value={newLigne.quantite_recue}
                onChange={(e) => setNewLigne({ ...newLigne, quantite_recue: e.target.value })}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddLigne}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter la ligne
          </Button>
        </section>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Total entrée (quantité reçue × prix)
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatDa(liveValeur)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={backToList} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </PageSurface>
    );
  }

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Inventaire"
        title="Entrées validées"
        description="Consultez et corrigez les entrées validées ou en litige — quantités envoyées et reçues."
      />

      {/* KPI dérivés des données chargées */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetaStat label="Entrées" value={formatNum(listStats.total)} />
        <MetaStat label="Validées" value={formatNum(listStats.valides)} tone="success" />
        <MetaStat label="Litiges" value={formatNum(listStats.litiges)} tone="danger" />
        <MetaStat label="Non payées" value={formatNum(listStats.nonPayees)} tone="warning" />
        <MetaStat label="Valeur (reçue)" value={formatDa(listStats.valeur)} />
      </div>

      {/* Recherche + filtres */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-search">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ve-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fournisseur ou référence…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-statut">
            Statut
          </label>
          <select
            id="ve-statut"
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Tous</option>
            <option value="valide">Validé</option>
            <option value="litige">Litige</option>
          </select>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ve-paye">
            Paiement
          </label>
          <select
            id="ve-paye"
            value={filterPaye}
            onChange={(e) => setFilterPaye(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Tous</option>
            <option value="paye">Payé</option>
            <option value="non_paye">Non payé</option>
          </select>
        </div>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              setSearchQuery('');
              setFilterStatut('');
              setFilterPaye('');
            }}
          >
            Réinitialiser
          </Button>
        )}
      </section>

      {/* Liste */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Liste des entrées
          </h2>
          <p className="text-xs text-muted-foreground">
            {loading
              ? 'Chargement…'
              : `${formatNum(filteredEntrees.length)} entrée(s)${
                  hasActiveFilters ? ' (filtrées)' : ''
                }`}
          </p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
            Chargement des entrées validées…
          </div>
        ) : filteredEntrees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">
              {entrees.length === 0 ? 'Aucune entrée validée' : 'Aucun résultat'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'Modifiez ou réinitialisez les filtres.'
                : 'Les entrées validées ou en litige apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Fournisseur</th>
                    <th className="px-3 py-2.5 font-medium">Lignes</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="px-3 py-2.5 font-medium">Paiement</th>
                    <th className="px-3 py-2.5 text-right font-medium">Valeur</th>
                    <th className="w-12 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntrees.map((entree) => {
                    const valeur = calcValeurTotale(entree.lignes);
                    const isLitige = entree.statut === 'litige';
                    return (
                      <tr
                        key={entree.entree_id}
                        className={cn(
                          'border-b border-border/40 last:border-0 hover:bg-muted/20',
                          isLitige && 'bg-[hsl(var(--danger)/0.04)]'
                        )}
                      >
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatDate(entree.date)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {entree.fournisseur_nom || 'Fournisseur'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {entree.lignes?.length || 0}
                        </td>
                        <td className="px-3 py-2.5">{renderStatutBadge(entree.statut)}</td>
                        <td className="px-3 py-2.5">{renderPayeBadge(entree.paye)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatDa(valeur)}
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
                              <DropdownMenuItem onClick={() => openDetail(entree)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ouvrir
                              </DropdownMenuItem>
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
              {filteredEntrees.map((entree) => {
                const valeur = calcValeurTotale(entree.lignes);
                const isLitige = entree.statut === 'litige';
                return (
                  <button
                    type="button"
                    key={entree.entree_id}
                    onClick={() => openDetail(entree)}
                    className={cn(
                      'w-full rounded-lg border border-border/80 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/20',
                      isLitige && 'border-[hsl(var(--danger)/0.4)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {entree.fournisseur_nom || 'Fournisseur'}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(entree.date)}
                          <span>·</span>
                          {entree.lignes?.length || 0} ligne
                          {(entree.lignes?.length || 0) !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {renderStatutBadge(entree.statut)}
                          {renderPayeBadge(entree.paye)}
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatDa(valeur)}
                      </p>
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

export default ValidatedEntries;
