/**
 * En attente de validation — administration.
 * Réutilise fetchEntreesEnAttente, fetchEntreeLignesDetail, update/add/deleteEntreeLigne,
 * validateEntree et les formules de src/utils/receptionValidation.js
 * (identiques à EmployeeValidation / validateEntree).
 *
 * Non supporté par l’API existante (pas d’écriture improvisée) :
 * - modification date / fournisseur de l’entrée ;
 * - changement de produit_id sur une ligne existante (seulement via suppression + ajout).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  calcManqueQte,
  calcReceptionTotals,
} from '@/utils/receptionValidation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatDaAmount = (value) =>
  Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR');

const formatPaires = (count) => {
  const n = Number(count) || 0;
  return `${n.toLocaleString('fr-FR')} paire${n > 1 ? 's' : ''}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums sm:text-base',
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

function LoadingBlock({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 px-4 py-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin opacity-60" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
      {Icon ? <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

const mapDetailLigne = (l) => {
  const qteEnvoyee = parseInt(l.qte_envoyee, 10) || 0;
  const qteRecueRaw = l.qte_recue;
  const qteRecue =
    qteRecueRaw == null || qteRecueRaw === ''
      ? qteEnvoyee
      : parseInt(qteRecueRaw, 10) || 0;
  return {
    _key: l.ligne_id,
    ligne_id: l.ligne_id,
    produit_id: l.produit_resolu_id || l.produit_id,
    produit_nom: l.produit_nom || 'Produit',
    reference: l.reference || '',
    prix_achat: parseFloat(l.prix_achat) || 0,
    quantite: qteEnvoyee,
    quantite_recue: qteRecue,
    qte_envoyee: qteEnvoyee,
    qteRecue,
    _isNew: false,
  };
};

const PendingEntries = () => {
  const dataCtx = useData();
  const { user } = useAuth();
  // Primitive stable — isAdmin() from AuthContext is a new function every Auth render.
  const isAdminUser = user?.role === 'admin';

  const [screen, setScreen] = useState('list');
  const [entrees, setEntrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [selectedEntree, setSelectedEntree] = useState(null);
  const [editLignes, setEditLignes] = useState([]);
  const [deletedLigneIds, setDeletedLigneIds] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [newLigne, setNewLigne] = useState({ produitId: '', quantite: '', quantite_recue: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmValidateOpen, setConfirmValidateOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Keep latest context API without putting unstable identities in effect deps.
  const dataCtxRef = useRef(dataCtx);
  dataCtxRef.current = dataCtx;
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const produits = useMemo(() => dataCtx?.produits ?? [], [dataCtx?.produits]);

  /**
   * Stable loader: reads fetch* from ref so Provider re-renders (new function
   * identities / new value object) do not recreate this callback or re-fire effects.
   */
  const loadEntrees = useCallback(async () => {
    const ctx = dataCtxRef.current;
    if (!ctx?.fetchEntreesEnAttente) return;
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const raw = await ctx.fetchEntreesEnAttente();
      const list = raw || [];
      const enriched = await Promise.all(
        list.map(async (entree) => {
          let lignes = [];
          try {
            if (ctx.fetchEntreeLignesDetail) {
              lignes = (await ctx.fetchEntreeLignesDetail(entree.id)) || [];
            }
          } catch (e) {
            console.error('Erreur lignes pending:', e);
          }
          const mapped = lignes.map(mapDetailLigne);
          const totals = calcReceptionTotals(mapped);
          return {
            ...entree,
            fournisseur_nom: entree.fournisseurs?.nom || '—',
            lignes: mapped,
            _stats: {
              lignesCount: mapped.length,
              qteEnvoyee: totals.qteEnvoyee,
              valeurEnvoyee: totals.envoye,
            },
          };
        })
      );
      if (!mountedRef.current || generation !== loadGenerationRef.current) return;
      setEntrees(enriched);
    } catch (e) {
      if (!mountedRef.current || generation !== loadGenerationRef.current) return;
      console.error('Erreur chargement entrées en attente:', e);
      setLoadError(e?.message || 'Impossible de charger les entrées en attente');
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Chargement impossible',
      });
    } finally {
      if (mountedRef.current && generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load only when an admin opens this view (stable primitives).
  // Strict Mode may double-invoke in dev; loadGenerationRef drops the stale run.
  useEffect(() => {
    if (!USE_SUPABASE || !isAdminUser) return undefined;

    loadEntrees();
    // Product catalog for the add-line picker (context update must not re-trigger this effect).
    dataCtxRef.current?.fetchProduits?.();

    return () => {
      // Invalidate in-flight initial load on unmount / Strict Mode remount.
      loadGenerationRef.current += 1;
    };
  }, [isAdminUser, user?.id, loadEntrees]);

  const listStats = useMemo(() => {
    let lignesCount = 0;
    let qteEnvoyee = 0;
    let valeurEnvoyee = 0;
    (entrees || []).forEach((e) => {
      lignesCount += e._stats?.lignesCount || 0;
      qteEnvoyee += e._stats?.qteEnvoyee || 0;
      valeurEnvoyee += e._stats?.valeurEnvoyee || 0;
    });
    return {
      entreesCount: (entrees || []).length,
      lignesCount,
      qteEnvoyee,
      valeurEnvoyee,
    };
  }, [entrees]);

  const filteredEntrees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entrees || [];
    return (entrees || []).filter((e) => {
      const nom = String(e.fournisseur_nom || '').toLowerCase();
      const id = String(e.id || '').toLowerCase();
      const date = String(e.date || '').toLowerCase();
      const dateFr = formatDate(e.date).toLowerCase();
      const produitHit = (e.lignes || []).some((l) => {
        const pn = String(l.produit_nom || '').toLowerCase();
        const ref = String(l.reference || '').toLowerCase();
        return pn.includes(q) || ref.includes(q);
      });
      return nom.includes(q) || id.includes(q) || date.includes(q) || dateFr.includes(q) || produitHit;
    });
  }, [entrees, searchQuery]);

  const detailTotals = useMemo(() => calcReceptionTotals(editLignes), [editLignes]);
  const hasManque = detailTotals.manquePaires > 0;

  const markDirty = () => setDirty(true);

  const resetDetail = () => {
    setSelectedEntree(null);
    setEditLignes([]);
    setDeletedLigneIds([]);
    setDirty(false);
    setNewLigne({ produitId: '', quantite: '', quantite_recue: '' });
    setConfirmValidateOpen(false);
    setConfirmDeleteKey(null);
    setScreen('list');
  };

  const requestBackToList = () => {
    if (dirty) {
      setConfirmLeaveOpen(true);
      return;
    }
    resetDetail();
  };

  const openDetail = async (entree) => {
    setLoadingDetail(true);
    setScreen('detail');
    setSelectedEntree(entree);
    setDeletedLigneIds([]);
    setDirty(false);
    setNewLigne({ produitId: '', quantite: '', quantite_recue: '' });
    try {
      let lignes = entree.lignes;
      if ((!lignes || lignes.length === 0) && dataCtx?.fetchEntreeLignesDetail) {
        const raw = await dataCtx.fetchEntreeLignesDetail(entree.id);
        lignes = (raw || []).map(mapDetailLigne);
      }
      setEditLignes(lignes || []);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger le détail',
      });
      resetDetail();
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleLigneChange = (key, field, value) => {
    const parsed = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setEditLignes((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        const next = { ...l, [field]: parsed };
        if (field === 'quantite') {
          next.qte_envoyee = parsed;
        }
        if (field === 'quantite_recue') {
          next.qteRecue = parsed;
        }
        return next;
      })
    );
    markDirty();
  };

  const handleAddLigne = () => {
    if (!newLigne.produitId) {
      toast({
        variant: 'destructive',
        title: 'Produit requis',
        description: 'Sélectionnez un produit pour ajouter une ligne.',
      });
      return;
    }
    const qte = Math.max(0, parseInt(newLigne.quantite, 10) || 0);
    if (qte <= 0) {
      toast({
        variant: 'destructive',
        title: 'Quantité invalide',
        description: 'Indiquez une quantité envoyée supérieure à 0.',
      });
      return;
    }
    const produit = produits.find((p) => p.id === newLigne.produitId);
    if (!produit) return;
    const qteRecue =
      newLigne.quantite_recue === ''
        ? qte
        : Math.max(0, parseInt(newLigne.quantite_recue, 10) || 0);
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEditLignes((prev) => [
      ...prev,
      {
        _key: key,
        ligne_id: null,
        _isNew: true,
        produit_id: produit.id,
        produit_nom: produit.nom,
        reference: produit.reference || '',
        prix_achat: parseFloat(produit.prix_achat ?? produit.prixAchat) || 0,
        quantite: qte,
        quantite_recue: qteRecue,
        qte_envoyee: qte,
        qteRecue,
      },
    ]);
    setNewLigne({ produitId: '', quantite: '', quantite_recue: '' });
    markDirty();
  };

  const requestDeleteLigne = (key) => setConfirmDeleteKey(key);

  const confirmDeleteLigne = () => {
    const key = confirmDeleteKey;
    setConfirmDeleteKey(null);
    if (!key) return;
    setEditLignes((prev) => {
      const target = prev.find((l) => l._key === key);
      if (target?.ligne_id && !target._isNew) {
        setDeletedLigneIds((ids) => [...ids, target.ligne_id]);
      }
      return prev.filter((l) => l._key !== key);
    });
    markDirty();
  };

  const persistEdits = async () => {
    if (!selectedEntree || !dataCtx) return false;
    for (const ligneId of deletedLigneIds) {
      await dataCtx.deleteEntreeLigne(ligneId);
    }
    for (const ligne of editLignes) {
      if (ligne._isNew) {
        await dataCtx.addEntreeLigne(selectedEntree.id, {
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
    return true;
  };

  const handleSave = async () => {
    if (!selectedEntree || !dataCtx) return;
    if (editLignes.length === 0 && deletedLigneIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Aucune ligne',
        description: 'Ajoutez au moins une ligne avant d’enregistrer.',
      });
      return;
    }
    setSaving(true);
    try {
      await persistEdits();
      await Promise.all([dataCtx.fetchEntrees?.(), loadEntrees()]);
      toast({
        title: 'Modifications enregistrées',
        description: 'Les lignes ont été mises à jour. L’entrée reste en attente.',
      });
      setDirty(false);
      setDeletedLigneIds([]);
      // Recharger le détail depuis la liste rafraîchie
      const refreshed = (await dataCtx.fetchEntreesEnAttente()) || [];
      const current = refreshed.find((e) => e.id === selectedEntree.id);
      if (current) {
        const raw = (await dataCtx.fetchEntreeLignesDetail(current.id)) || [];
        setSelectedEntree({
          ...current,
          fournisseur_nom: current.fournisseurs?.nom || selectedEntree.fournisseur_nom,
        });
        setEditLignes(raw.map(mapDetailLigne));
      } else {
        resetDetail();
      }
    } catch (e) {
      console.error('Erreur sauvegarde pending:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible d’enregistrer les modifications',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleValidateConfirm = async () => {
    if (!selectedEntree || !dataCtx?.validateEntree) return;
    if (editLignes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Impossible de valider',
        description: 'Aucune ligne à valider.',
      });
      return;
    }
    setValidating(true);
    try {
      if (dirty) {
        await persistEdits();
      }
      // Recharger les IDs de lignes après éventuel insert
      const raw = (await dataCtx.fetchEntreeLignesDetail(selectedEntree.id)) || [];
      const lignesRecues = raw.map((l) => {
        const mapped = mapDetailLigne(l);
        const local = editLignes.find(
          (x) =>
            x.ligne_id === l.ligne_id ||
            (x._isNew && x.produit_id === mapped.produit_id && x.quantite === mapped.quantite)
        );
        return {
          ligne_id: l.ligne_id,
          quantite_recue: local ? local.qteRecue : mapped.qteRecue,
        };
      });

      // Prefer local editLignes order when all have ligne_id
      const allHaveId = editLignes.every((l) => l.ligne_id);
      const payloadLignes = allHaveId
        ? editLignes.map((l) => ({
            ligne_id: l.ligne_id,
            quantite_recue: l.qteRecue,
          }))
        : lignesRecues;

      const result = await dataCtx.validateEntree({
        entreeId: selectedEntree.id,
        fournisseurId: selectedEntree.fournisseur_id,
        validatedBy: user?.id,
        lignesRecues: payloadLignes,
      });

      toast({
        title: result?.statut === 'litige' ? 'Envoi en litige' : 'Envoi validé',
        description:
          result?.statut === 'litige'
            ? `Litige enregistré — ${formatPaires(result.totalManquePaires)} · ${formatDa(result.totalManqueValeur)}. Le fournisseur a été notifié.`
            : 'Réception conforme — entrée validée avec succès.',
      });
      setConfirmValidateOpen(false);
      setDirty(false);
      resetDetail();
      await loadEntrees();
    } catch (e) {
      console.error('Erreur validation pending:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur de validation',
        description: e?.message || 'La validation a échoué',
      });
    } finally {
      setValidating(false);
    }
  };

  // ——— Gates ———
  if (!isAdminUser) {
    return (
      <PageSurface>
        <PageHeader
          eyebrow="Inventaire"
          title="En attente de validation"
          description="Accès réservé aux administrateurs."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
          Accès restreint — réservé aux administrateurs.
        </div>
      </PageSurface>
    );
  }

  if (!USE_SUPABASE) {
    return (
      <PageSurface>
        <PageHeader
          eyebrow="Inventaire"
          title="En attente de validation"
          description="Cette section nécessite Supabase."
        />
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
          Mode localStorage : les entrées en attente ne sont pas disponibles.
        </div>
      </PageSurface>
    );
  }

  // ——— Détail ———
  if (screen === 'detail' && selectedEntree) {
    return (
      <PageSurface className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={requestBackToList}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
          {dirty ? (
            <span className="text-xs text-[hsl(var(--warning))]">Modifications non enregistrées</span>
          ) : null}
          {saving || validating ? (
            <span className="text-xs text-muted-foreground">Traitement en cours…</span>
          ) : null}
        </div>

        <PageHeader
          eyebrow="Détail"
          title={selectedEntree.fournisseur_nom || 'Fournisseur'}
          description={`Entrée du ${formatDate(selectedEntree.date)} · correction avant validation.`}
          actions={<StatusBadge status="en_attente" />}
        />

        {loadingDetail ? (
          <LoadingBlock label="Chargement du détail…" />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetaStat label="Fournisseur" value={selectedEntree.fournisseur_nom || '—'} />
              <MetaStat label="Date" value={formatDate(selectedEntree.date)} />
              <MetaStat
                label="Identifiant"
                value={`${String(selectedEntree.id || '').slice(0, 8)}…`}
              />
              <MetaStat label="Statut" value="En attente" tone="warning" />
              <MetaStat
                label="Paiement"
                value={selectedEntree.paye ? 'Payé' : 'Non payé'}
              />
              <MetaStat label="Lignes" value={formatNum(editLignes.length)} />
            </section>

            <p className="text-xs text-muted-foreground">
              Date et fournisseur sont en lecture seule (aucune API de mise à jour d’en-tête). Le
              produit d’une ligne existante ne peut pas être modifié via{' '}
              <code className="text-[11px]">updateEntreeLigne</code> — supprimez puis ajoutez une
              ligne.
            </p>

            {hasManque ? (
              <div
                role="status"
                className="flex gap-3 rounded-lg border border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.1)] px-3 py-3 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div>
                  <p className="font-medium">Écarts / manques détectés</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPaires(detailTotals.manquePaires)} manquantes · {formatDa(detailTotals.manque)}
                  </p>
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Lignes de produits
                </h2>
                <p className="text-xs text-muted-foreground">
                  Quantités envoyées / reçues — manques calculés immédiatement.
                </p>
              </div>

              {editLignes.length === 0 ? (
                <EmptyBlock
                  icon={Package}
                  title="Aucune ligne"
                  description="Ajoutez un produit ci-dessous."
                />
              ) : (
                <>
                  <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Produit</th>
                          <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                          <th className="px-3 py-2.5 text-right font-medium">Envoyée</th>
                          <th className="px-3 py-2.5 text-right font-medium">Reçue</th>
                          <th className="px-3 py-2.5 text-right font-medium">Manque</th>
                          <th className="px-3 py-2.5 text-right font-medium">Val. envoyée</th>
                          <th className="px-3 py-2.5 text-right font-medium">Val. reçue</th>
                          <th className="w-10 px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {editLignes.map((ligne) => {
                          const manqueQte = calcManqueQte(ligne.quantite, ligne.quantite_recue);
                          const manqueDa = manqueQte * (ligne.prix_achat || 0);
                          const valEnv = (ligne.quantite || 0) * (ligne.prix_achat || 0);
                          const valRec = (ligne.quantite_recue || 0) * (ligne.prix_achat || 0);
                          return (
                            <tr
                              key={ligne._key}
                              className={cn(
                                'border-b border-border/40 last:border-0',
                                manqueQte > 0 && 'bg-[hsl(var(--danger)/0.05)]'
                              )}
                            >
                              <td className="px-3 py-2.5">
                                <p className="font-medium">
                                  {ligne.reference ? `${ligne.reference} · ` : ''}
                                  {ligne.produit_nom}
                                </p>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatDa(ligne.prix_achat)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  className="ml-auto h-9 w-24 text-right"
                                  value={ligne.quantite}
                                  onChange={(e) =>
                                    handleLigneChange(ligne._key, 'quantite', e.target.value)
                                  }
                                  disabled={saving || validating}
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  className="ml-auto h-9 w-24 text-right"
                                  value={ligne.quantite_recue}
                                  onChange={(e) =>
                                    handleLigneChange(ligne._key, 'quantite_recue', e.target.value)
                                  }
                                  disabled={saving || validating}
                                />
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2.5 text-right font-semibold tabular-nums',
                                  manqueQte > 0 ? 'text-danger' : 'text-success'
                                )}
                              >
                                {manqueQte > 0
                                  ? `−${formatPaires(manqueQte)} · −${formatDaAmount(manqueDa)} DA`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatDa(valEnv)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatDa(valRec)}
                              </td>
                              <td className="px-2 py-2.5 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  aria-label="Supprimer la ligne"
                                  onClick={() => requestDeleteLigne(ligne._key)}
                                  disabled={saving || validating}
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

                  <div className="space-y-3 md:hidden">
                    {editLignes.map((ligne) => {
                      const manqueQte = calcManqueQte(ligne.quantite, ligne.quantite_recue);
                      const manqueDa = manqueQte * (ligne.prix_achat || 0);
                      return (
                        <div
                          key={ligne._key}
                          className={cn(
                            'rounded-lg border border-border/80 px-3 py-3',
                            manqueQte > 0 &&
                              'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.05)]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{ligne.produit_nom}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDa(ligne.prix_achat)} / paire
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              aria-label="Supprimer la ligne"
                              onClick={() => requestDeleteLigne(ligne._key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground">Envoyée</label>
                              <Input
                                type="number"
                                min="0"
                                className="h-9"
                                value={ligne.quantite}
                                onChange={(e) =>
                                  handleLigneChange(ligne._key, 'quantite', e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-muted-foreground">Reçue</label>
                              <Input
                                type="number"
                                min="0"
                                className="h-9"
                                value={ligne.quantite_recue}
                                onChange={(e) =>
                                  handleLigneChange(ligne._key, 'quantite_recue', e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <p
                            className={cn(
                              'mt-2 text-xs font-semibold',
                              manqueQte > 0 ? 'text-danger' : 'text-success'
                            )}
                          >
                            Manque :{' '}
                            {manqueQte > 0
                              ? `−${formatPaires(manqueQte)} · −${formatDaAmount(manqueDa)} DA`
                              : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Ajout ligne */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <p className="mb-2 text-sm font-medium">Ajouter une ligne</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground">Produit</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
                      value={newLigne.produitId}
                      onChange={(e) =>
                        setNewLigne((prev) => ({ ...prev, produitId: e.target.value }))
                      }
                    >
                      <option value="">Sélectionner un produit</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full space-y-1 sm:w-28">
                    <label className="text-[11px] text-muted-foreground">Envoyée</label>
                    <Input
                      type="number"
                      min="0"
                      value={newLigne.quantite}
                      onChange={(e) =>
                        setNewLigne((prev) => ({ ...prev, quantite: e.target.value }))
                      }
                    />
                  </div>
                  <div className="w-full space-y-1 sm:w-28">
                    <label className="text-[11px] text-muted-foreground">Reçue</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="= envoyée"
                      value={newLigne.quantite_recue}
                      onChange={(e) =>
                        setNewLigne((prev) => ({ ...prev, quantite_recue: e.target.value }))
                      }
                    />
                  </div>
                  <Button type="button" onClick={handleAddLigne}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 sm:grid-cols-4">
              <MetaStat label="Valeur envoyée" value={formatDa(detailTotals.envoye)} tone="info" />
              <MetaStat label="Valeur reçue" value={formatDa(detailTotals.recu)} tone="success" />
              <MetaStat
                label="Valeur manquante"
                value={
                  hasManque
                    ? `${formatDa(detailTotals.manque)} · ${formatPaires(detailTotals.manquePaires)}`
                    : '—'
                }
                tone={hasManque ? 'danger' : 'success'}
              />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Statut prévu</p>
                <div className="mt-1">
                  {hasManque ? (
                    <StatusBadge status="litige" />
                  ) : (
                    <StatusBadge status="valide" label="Validé" />
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={!dirty || saving || validating}
              >
                <Save className="mr-2 h-4 w-4" />
                Enregistrer les modifications
              </Button>
              <Button
                type="button"
                variant={hasManque ? 'destructive' : 'default'}
                onClick={() => setConfirmValidateOpen(true)}
                disabled={editLignes.length === 0 || saving || validating}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {hasManque ? 'Valider avec litige' : 'Valider la réception'}
              </Button>
            </div>
          </>
        )}

        {/* Confirm delete ligne */}
        <Dialog
          open={confirmDeleteKey != null}
          onOpenChange={(open) => !open && setConfirmDeleteKey(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer cette ligne ?</DialogTitle>
              <DialogDescription>
                La suppression sera effective après « Enregistrer les modifications » (ou lors de
                la validation si des changements sont encore en attente).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteKey(null)}>
                Annuler
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDeleteLigne}>
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm leave dirty */}
        <Dialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quitter sans enregistrer ?</DialogTitle>
              <DialogDescription>
                Des modifications non sauvegardées seront perdues.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmLeaveOpen(false)}>
                Rester
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setConfirmLeaveOpen(false);
                  resetDetail();
                }}
              >
                Quitter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm validate */}
        <Dialog open={confirmValidateOpen} onOpenChange={setConfirmValidateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {hasManque ? 'Confirmer le litige ?' : 'Confirmer la validation ?'}
              </DialogTitle>
              <DialogDescription>
                {hasManque
                  ? `Un manque de ${formatPaires(detailTotals.manquePaires)} (${formatDa(detailTotals.manque)}) sera enregistré. Le statut passera à litige et le fournisseur sera notifié.`
                  : 'Réception conforme — le statut passera à validé. Aucune notification de manque.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetaStat label="Qté envoyée" value={formatPaires(detailTotals.qteEnvoyee)} />
              <MetaStat label="Qté reçue" value={formatPaires(detailTotals.qteRecue)} />
              <MetaStat
                label="Paires manquantes"
                value={formatPaires(detailTotals.manquePaires)}
                tone={hasManque ? 'danger' : 'success'}
              />
              <MetaStat
                label="Valeur manquante"
                value={formatDa(detailTotals.manque)}
                tone={hasManque ? 'danger' : 'success'}
              />
              <div className="col-span-2">
                <p className="text-[11px] text-muted-foreground">Statut final prévu</p>
                <div className="mt-1">
                  {hasManque ? (
                    <StatusBadge status="litige" />
                  ) : (
                    <StatusBadge status="valide" label="Validé" />
                  )}
                </div>
              </div>
            </div>
            {dirty ? (
              <p className="text-xs text-[hsl(var(--warning))]">
                Les modifications non enregistrées seront sauvegardées avant la validation.
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmValidateOpen(false)}
                disabled={validating}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant={hasManque ? 'destructive' : 'default'}
                onClick={handleValidateConfirm}
                disabled={validating}
              >
                {validating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validation…
                  </>
                ) : hasManque ? (
                  'Valider avec litige'
                ) : (
                  'Valider la réception'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSurface>
    );
  }

  // ——— Liste ———
  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Inventaire"
        title="En attente de validation"
        description="Corrigez et validez les envois fournisseurs avant intégration au stock."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={loadEntrees} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Entrées en attente" value={formatNum(listStats.entreesCount)} tone="warning" />
        <MetaStat label="Lignes" value={formatNum(listStats.lignesCount)} />
        <MetaStat label="Qté envoyée" value={formatPaires(listStats.qteEnvoyee)} />
        <MetaStat label="Valeur envoyée" value={formatDa(listStats.valeurEnvoyee)} tone="info" />
      </section>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Fournisseur, produit, date ou identifiant…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Rechercher une entrée en attente"
        />
      </div>

      {loading ? (
        <LoadingBlock label="Chargement des entrées en attente…" />
      ) : loadError ? (
        <EmptyBlock
          icon={AlertTriangle}
          title="Erreur de chargement"
          description={loadError}
        />
      ) : filteredEntrees.length === 0 ? (
        <EmptyBlock
          icon={Clock}
          title="Aucune entrée en attente de validation"
          description={
            searchQuery.trim()
              ? 'Aucun résultat pour cette recherche.'
              : 'Les nouveaux envois fournisseurs apparaîtront ici.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Fournisseur</th>
                  <th className="px-3 py-2.5 font-medium">Identifiant</th>
                  <th className="px-3 py-2.5 text-right font-medium">Lignes</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qté envoyée</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valeur</th>
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntrees.map((entree) => (
                  <tr key={entree.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(entree.date)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {entree.fournisseur_nom}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {String(entree.id).slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNum(entree._stats?.lignesCount || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNum(entree._stats?.qteEnvoyee || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatDa(entree._stats?.valeurEnvoyee || 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status="en_attente" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="sm">
                            Actions
                            <MoreHorizontal className="ml-1 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(entree)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir et modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openDetail(entree).then(() => setConfirmValidateOpen(true));
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Valider
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredEntrees.map((entree) => (
              <div key={entree.id} className="rounded-lg border border-border/80 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entree.fournisseur_nom}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(entree.date)} · {formatNum(entree._stats?.lignesCount || 0)}{' '}
                      ligne(s)
                    </p>
                  </div>
                  <StatusBadge status="en_attente" />
                </div>
                <p className="mt-2 text-sm tabular-nums">
                  {formatDa(entree._stats?.valeurEnvoyee || 0)} ·{' '}
                  {formatPaires(entree._stats?.qteEnvoyee || 0)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openDetail(entree)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Voir et modifier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      openDetail(entree).then(() => setConfirmValidateOpen(true));
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Valider
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageSurface>
  );
};

export default PendingEntries;
