/**
 * Accès & assignations — présentation uniquement.
 * Rôles, fournisseur_id, validations, payloads, assignations,
 * createCompte, requêtes et dual-path inchangés.
 */
import { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Package,
  UserPlus,
  Search,
  Building2,
  Check,
  X,
  AlertCircle,
  Link2,
  Users,
  Shield,
  RotateCcw,
  Loader2,
} from 'lucide-react';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const EMPTY_COMPTE_FORM = {
  nom: '',
  role: 'fournisseur',
  username: '',
  password: '',
  fournisseur_id: '',
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

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const SupplierAccess = () => {
  const dataCtx = useData();
  const produits = dataCtx?.produits ?? [];
  const fournisseurs = dataCtx?.fournisseurs ?? [];
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [assignations, setAssignations] = useState([]);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAssignations, setLoadingAssignations] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const [compteForm, setCompteForm] = useState({ ...EMPTY_COMPTE_FORM });
  const [creatingCompte, setCreatingCompte] = useState(false);

  const reloadAssignations = async () => {
    if (!dataCtx?.fetchAssignations) return;
    setLoadingAssignations(true);
    try {
      const data = await dataCtx.fetchAssignations();
      setAssignations(data || []);
    } catch (e) {
      console.error('Erreur chargement assignations:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les assignations',
      });
    } finally {
      setLoadingAssignations(false);
    }
  };

  useEffect(() => {
    if (!USE_SUPABASE || !isAdmin()) return;
    dataCtx?.fetchProduits?.();
    dataCtx?.fetchFournisseurs?.();
    reloadAssignations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assignedProduitIds = useMemo(() => {
    if (!selectedFournisseurId) return new Set();
    return new Set(
      assignations
        .filter((a) => a.fournisseur_id === selectedFournisseurId)
        .map((a) => a.produit_id)
    );
  }, [assignations, selectedFournisseurId]);

  const filteredProduits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter((p) => {
      const nom = (p.nom || '').toLowerCase();
      const ref = (p.reference || '').toLowerCase();
      return nom.includes(q) || ref.includes(q);
    });
  }, [produits, searchQuery]);

  const assignedCount = useMemo(
    () => filteredProduits.filter((p) => assignedProduitIds.has(p.id)).length,
    [filteredProduits, assignedProduitIds]
  );

  const availableCount = filteredProduits.length - assignedCount;

  const selectedFournisseur =
    fournisseurs.find((f) => f.id === selectedFournisseurId) || null;

  const handleToggleAssignation = async (produitId) => {
    if (!selectedFournisseurId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Sélectionnez d\'abord un fournisseur',
      });
      return;
    }

    const isAssigned = assignedProduitIds.has(produitId);
    setTogglingId(produitId);
    try {
      if (isAssigned) {
        await dataCtx.unassignProduit(produitId, selectedFournisseurId);
      } else {
        await dataCtx.assignProduit(produitId, selectedFournisseurId);
      }
      await reloadAssignations();
      toast({
        title: isAssigned ? 'Produit retiré' : 'Produit assigné',
        description: isAssigned
          ? 'Le produit n\'est plus assigné à ce fournisseur.'
          : 'Le produit a été assigné au fournisseur.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de modifier l\'assignation',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateCompte = async () => {
    if (!compteForm.nom || !compteForm.username || !compteForm.password) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Nom, identifiant et mot de passe sont obligatoires',
      });
      return;
    }

    if (compteForm.role === 'fournisseur' && !compteForm.fournisseur_id) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Sélectionnez un fournisseur pour ce compte',
      });
      return;
    }

    setCreatingCompte(true);
    try {
      await dataCtx.createCompte({
        nom: compteForm.nom,
        username: compteForm.username,
        password: compteForm.password,
        role: compteForm.role,
        fournisseur_id:
          compteForm.role === 'fournisseur' ? compteForm.fournisseur_id : null,
      });

      toast({
        title: 'Compte créé',
        description: `Le compte "${compteForm.username}" (${compteForm.role}) a été créé.`,
      });

      setCompteForm({ ...EMPTY_COMPTE_FORM });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de créer le compte',
      });
    } finally {
      setCreatingCompte(false);
    }
  };

  const resetCompteForm = () => {
    setCompteForm({ ...EMPTY_COMPTE_FORM });
  };

  if (!isAdmin()) {
    return (
      <PageSurface className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Accès & assignations"
          description="Gestion des accès fournisseurs et des produits attribués."
        />
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="w-full max-w-md rounded-lg border border-border/80 bg-card px-6 py-8 text-center">
            <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="font-display text-base font-semibold">Accès restreint</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette section est réservée aux administrateurs.
            </p>
          </div>
        </div>
      </PageSurface>
    );
  }

  if (!USE_SUPABASE) {
    return (
      <PageSurface className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Accès & assignations"
          description="Gestion des accès fournisseurs et des produits attribués."
        />
        <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border/80 px-6 py-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Supabase requis</p>
          <p className="mt-1 text-xs text-muted-foreground">
            La gestion des accès fournisseurs nécessite Supabase.
          </p>
        </div>
      </PageSurface>
    );
  }

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Accès & assignations"
        description="Assignez des produits aux fournisseurs et créez les comptes d’accès au portail."
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Fournisseurs" value={formatNum(fournisseurs.length)} />
        <MetaStat label="Produits" value={formatNum(produits.length)} tone="info" />
        <MetaStat
          label="Assignés (filtre)"
          value={selectedFournisseurId ? formatNum(assignedCount) : '—'}
          tone="success"
        />
        <MetaStat
          label="Disponibles (filtre)"
          value={selectedFournisseurId ? formatNum(availableCount) : '—'}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Zone 1 — Assignations produits–fournisseurs */}
        <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight">
                Assignations produits
              </h2>
              <p className="text-xs text-muted-foreground">
                Choisissez un fournisseur, puis assignez ou retirez les produits qu’il peut
                envoyer.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="access-supplier">
              Fournisseur *
            </label>
            <select
              id="access-supplier"
              value={selectedFournisseurId}
              onChange={(e) => setSelectedFournisseurId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Sélectionner un fournisseur</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="relative space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="access-product-search">
              Recherche produit
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="access-product-search"
                type="search"
                placeholder="Nom ou référence…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8"
                disabled={!selectedFournisseurId}
              />
            </div>
          </div>

          {selectedFournisseurId && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">
                {selectedFournisseur?.nom || 'Fournisseur'}
              </span>
              <span>·</span>
              <span>
                {formatNum(assignedCount)} / {formatNum(filteredProduits.length)} assigné(s)
                {searchQuery.trim() ? ' (filtrés)' : ''}
              </span>
            </div>
          )}

          {!selectedFournisseurId ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Aucun fournisseur sélectionné</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sélectionnez un fournisseur pour gérer ses produits assignés.
              </p>
            </div>
          ) : loadingAssignations ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 px-4 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin opacity-60" />
              <p className="text-sm">Chargement des assignations…</p>
            </div>
          ) : filteredProduits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Aucun produit trouvé</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? `Aucun résultat pour « ${searchQuery.trim()} »`
                  : 'Aucun produit disponible dans le catalogue.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden max-h-[480px] overflow-auto rounded-lg border border-border/80 md:block">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Produit</th>
                      <th className="px-3 py-2.5 font-medium">État</th>
                      <th className="w-[120px] px-3 py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProduits.map((produit) => {
                      const isAssigned = assignedProduitIds.has(produit.id);
                      const isToggling = togglingId === produit.id;
                      return (
                        <tr
                          key={produit.id}
                          className={cn(
                            'border-b border-border/60 last:border-0',
                            isAssigned && 'bg-[hsl(var(--success)/0.06)]'
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex min-w-0 items-start gap-2">
                              <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{produit.nom}</p>
                                {produit.reference ? (
                                  <p className="text-xs text-muted-foreground">
                                    Réf. {produit.reference}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {isAssigned ? (
                              <StatusBadge status="valide" label="Assigné" />
                            ) : (
                              <StatusBadge status="en_attente" label="Non assigné" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={isAssigned ? 'outline' : 'default'}
                              disabled={isToggling}
                              onClick={() => handleToggleAssignation(produit.id)}
                              className={cn(
                                'h-8',
                                isAssigned &&
                                  'border-[hsl(var(--danger)/0.45)] text-danger hover:bg-[hsl(var(--danger)/0.08)]'
                              )}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isAssigned ? (
                                <>
                                  <X className="mr-1 h-3.5 w-3.5" />
                                  Retirer
                                </>
                              ) : (
                                <>
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                  Assigner
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="max-h-[480px] space-y-2 overflow-y-auto md:hidden">
                {filteredProduits.map((produit) => {
                  const isAssigned = assignedProduitIds.has(produit.id);
                  const isToggling = togglingId === produit.id;
                  return (
                    <div
                      key={produit.id}
                      className={cn(
                        'rounded-lg border border-border/80 px-3 py-3',
                        isAssigned &&
                          'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.06)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{produit.nom}</p>
                            {isAssigned ? (
                              <StatusBadge status="valide" label="Assigné" />
                            ) : (
                              <StatusBadge status="en_attente" label="Non assigné" />
                            )}
                          </div>
                          {produit.reference ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Réf. {produit.reference}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isAssigned ? 'outline' : 'default'}
                          disabled={isToggling}
                          onClick={() => handleToggleAssignation(produit.id)}
                          className={cn(
                            'h-8 shrink-0',
                            isAssigned &&
                              'border-[hsl(var(--danger)/0.45)] text-danger hover:bg-[hsl(var(--danger)/0.08)]'
                          )}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isAssigned ? (
                            <>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Retirer
                            </>
                          ) : (
                            <>
                              <Check className="mr-1 h-3.5 w-3.5" />
                              Assigner
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Zone 2 — Création et gestion des accès */}
        <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight">
                Créer un compte d’accès
              </h2>
              <p className="text-xs text-muted-foreground">
                Compte fournisseur (portail d’envoi) ou employé (validation à réception).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[hsl(var(--info))]" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fournisseur
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Accès au portail d’envoi. Lié à un fournisseur via{' '}
                <span className="font-medium text-foreground">fournisseur_id</span>.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Users className="h-4 w-4 text-[hsl(var(--success))]" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Employé
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Accès à la validation des réceptions. Aucun fournisseur associé requis.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compte-role">
                Rôle *
              </label>
              <select
                id="compte-role"
                value={compteForm.role}
                onChange={(e) =>
                  setCompteForm({
                    ...compteForm,
                    role: e.target.value,
                    fournisseur_id:
                      e.target.value === 'fournisseur' ? compteForm.fournisseur_id : '',
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="fournisseur">Fournisseur</option>
                <option value="employe">Employé</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compte-nom">
                Nom affiché *
              </label>
              <Input
                id="compte-nom"
                value={compteForm.nom}
                onChange={(e) => setCompteForm({ ...compteForm, nom: e.target.value })}
                placeholder="Ex: Ahmed Fournisseur"
                className="h-9"
              />
            </div>

            {compteForm.role === 'fournisseur' && (
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="compte-fournisseur"
                >
                  Fournisseur associé *
                </label>
                <select
                  id="compte-fournisseur"
                  value={compteForm.fournisseur_id}
                  onChange={(e) =>
                    setCompteForm({ ...compteForm, fournisseur_id: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="compte-username"
                >
                  Identifiant *
                </label>
                <Input
                  id="compte-username"
                  value={compteForm.username}
                  onChange={(e) => setCompteForm({ ...compteForm, username: e.target.value })}
                  placeholder="nom.utilisateur"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="compte-password"
                >
                  Mot de passe *
                </label>
                <Input
                  id="compte-password"
                  type="password"
                  value={compteForm.password}
                  onChange={(e) => setCompteForm({ ...compteForm, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.08)] px-3 py-3 text-sm text-[hsl(var(--warning))]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs leading-relaxed">
                Les mots de passe sont stockés en clair pour l&apos;instant. À migrer vers un
                hachage sécurisé en production.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={handleCreateCompte}
                disabled={creatingCompte}
                className="flex-1"
              >
                {creatingCompte ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {creatingCompte ? 'Création…' : 'Créer le compte'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetCompteForm}
                disabled={creatingCompte}
                className="sm:w-auto"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Réinitialiser
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageSurface>
  );
};

export default SupplierAccess;
