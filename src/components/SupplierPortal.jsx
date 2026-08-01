/**
 * Portail fournisseur — présentation uniquement.
 * Isolation fournisseur_id, produits assignés, statuts, paye:false,
 * payloads, calculs, notifications et requêtes inchangés.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
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
  LayoutDashboard,
  Package,
  Bell,
  Send,
  Plus,
  Trash2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  ClipboardList,
  Calendar,
  Clock,
  CheckCheck,
  Loader2,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'mes-envois', label: 'Mes envois', icon: ClipboardList },
  { id: 'envoi', label: 'Créer un envoi', icon: Package },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const formatDa = (value) => `${formatNumber(value)} DA`;

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const getStatutBadge = (statut) => {
  switch (statut) {
    case 'en_attente':
      return <StatusBadge status="en_attente" label="En attente" />;
    case 'valide':
      return <StatusBadge status="valide" label="Validé" />;
    case 'litige':
      return <StatusBadge status="litige" label="Litige" />;
    default:
      return <StatusBadge status="info" label={statut || '—'} />;
  }
};

const formatProduitOption = (produit) => {
  const refPart = produit.reference ? `${produit.reference} · ` : '';
  return `${refPart}${produit.nom} — ${formatDa(produit.prix_achat)}`;
};

function MetaStat({ label, value, tone, hint }) {
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
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
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
    <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center">
      {Icon ? <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

const SupplierPortal = () => {
  const dataCtx = useData();
  const { user } = useAuth();
  const { toast } = useToast();

  const fournisseurId = user?.fournisseur_id ?? null;

  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [produitsAssignes, setProduitsAssignes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [envois, setEnvois] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingProduits, setLoadingProduits] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingEnvois, setLoadingEnvois] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const initialLoadDone = useRef(false);

  const [envoiForm, setEnvoiForm] = useState({
    date: new Date().toISOString().split('T')[0],
    lignes: [],
  });
  const [currentLigne, setCurrentLigne] = useState({ produitId: '', quantite: '' });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.lu).length,
    [notifications]
  );

  const envoiTotal = useMemo(
    () =>
      envoiForm.lignes.reduce(
        (sum, l) => sum + l.quantite * (l.prixAchat || 0),
        0
      ),
    [envoiForm.lignes]
  );

  const envoisEnAttente = useMemo(
    () => envois.filter((e) => e.statut === 'en_attente'),
    [envois]
  );

  const envoisValides = useMemo(
    () => envois.filter((e) => e.statut === 'valide' || e.statut === 'litige'),
    [envois]
  );

  const reloadEnvois = async () => {
    if (!fournisseurId || !dataCtx?.fetchEnvoisFournisseur) return;
    setLoadingEnvois(true);
    try {
      const data = await dataCtx.fetchEnvoisFournisseur(fournisseurId);
      setEnvois(data || []);
    } catch (e) {
      console.error('Erreur chargement envois:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger vos envois',
      });
    } finally {
      setLoadingEnvois(false);
    }
  };

  const reloadDashboard = async () => {
    if (!fournisseurId || !dataCtx?.fetchFournisseurDashboard) return;
    setLoadingDashboard(true);
    try {
      const data = await dataCtx.fetchFournisseurDashboard(fournisseurId);
      setDashboard(data);
    } catch (e) {
      console.error('Erreur chargement dashboard:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger le tableau de bord',
      });
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Au montage : exactement 3 requêtes (dashboard agrégé, produits assignés, notifications)
  useEffect(() => {
    if (!fournisseurId || !USE_SUPABASE || initialLoadDone.current) return;
    initialLoadDone.current = true;

    let cancelled = false;

    const loadInitialData = async () => {
      setLoadingDashboard(true);
      setLoadingProduits(true);
      setLoadingNotifications(true);

      try {
        const [dashboardData, produitsData, notificationsData] = await Promise.all([
          dataCtx?.fetchFournisseurDashboard?.(fournisseurId),
          dataCtx?.fetchProduitsAssignes?.(fournisseurId),
          dataCtx?.fetchNotifications?.(fournisseurId),
        ]);

        if (cancelled) return;

        setDashboard(dashboardData ?? null);
        setProduitsAssignes(produitsData || []);
        setNotifications(notificationsData || []);
      } catch (e) {
        console.error('Erreur chargement portail fournisseur:', e);
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: e?.message || 'Impossible de charger les données',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingDashboard(false);
          setLoadingProduits(false);
          setLoadingNotifications(false);
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fournisseurId]);

  useEffect(() => {
    if (activeTab === 'mes-envois' && fournisseurId && USE_SUPABASE) {
      reloadEnvois();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fournisseurId]);

  const handleAddLigne = () => {
    if (!currentLigne.produitId || !currentLigne.quantite) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Sélectionnez un produit et une quantité',
      });
      return;
    }

    const quantite = parseInt(currentLigne.quantite, 10);
    if (!quantite || quantite <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'La quantité doit être supérieure à 0',
      });
      return;
    }

    const produit = produitsAssignes.find((p) => p.id === currentLigne.produitId);
    setEnvoiForm((prev) => ({
      ...prev,
      lignes: [
        ...prev.lignes,
        {
          produitId: currentLigne.produitId,
          produitNom: produit?.nom || 'Produit',
          produitReference: produit?.reference || '',
          prixAchat: parseFloat(produit?.prix_achat) || 0,
          quantite,
        },
      ],
    }));
    setCurrentLigne({ produitId: '', quantite: '' });
  };

  const handleRemoveLigne = (index) => {
    setEnvoiForm((prev) => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitEnvoi = async () => {
    if (!envoiForm.date) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'La date est obligatoire',
      });
      return;
    }

    if (envoiForm.lignes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Ajoutez au moins une ligne de produit',
      });
      return;
    }

    setSubmitting(true);
    try {
      await dataCtx.addEntreeWithLines({
        date: envoiForm.date,
        fournisseur_id: fournisseurId,
        paye: false,
        created_by: user.id,
        lignes: envoiForm.lignes.map((l) => ({
          produit_id: l.produitId,
          quantite: l.quantite,
        })),
      });

      toast({
        title: 'Envoi enregistré',
        description: 'Votre envoi a été soumis et est en attente de validation.',
      });

      setEnvoiForm({
        date: new Date().toISOString().split('T')[0],
        lignes: [],
      });
      setCurrentLigne({ produitId: '', quantite: '' });
      await Promise.all([reloadDashboard(), reloadEnvois()]);
      setActiveTab('mes-envois');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || "Impossible d'enregistrer l'envoi",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await dataCtx.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, lu: true } : n))
      );
      toast({
        title: 'Notification lue',
        description: 'La notification a été marquée comme lue.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de marquer la notification',
      });
    }
  };

  const renderEnvoiCard = (envoi, treated) => (
    <div
      key={envoi.entree_id}
      className={cn(
        'rounded-lg border border-border/80 px-3 py-3 sm:px-4',
        envoi.statut === 'en_attente' &&
          'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.06)]',
        envoi.statut === 'litige' &&
          'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.06)]',
        envoi.statut === 'valide' &&
          'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.04)]'
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{formatDate(envoi.date_envoi)}</span>
        </div>
        {getStatutBadge(envoi.statut)}
      </div>
      <Separator className="mb-3" />
      <ul className="space-y-2.5">
        {envoi.lignes.map((ligne, idx) => (
          <li key={idx} className="text-sm">
            <p className="font-medium">
              {ligne.reference ? `${ligne.reference} · ` : ''}
              {ligne.produit_nom}
            </p>
            {!treated ? (
              <p className="text-xs text-muted-foreground">
                {formatNumber(ligne.qte_envoyee)}{' '}
                {ligne.qte_envoyee !== 1 ? 'paires envoyées' : 'paire envoyée'}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Envoyé : {formatNumber(ligne.qte_envoyee)} paire
                  {ligne.qte_envoyee !== 1 ? 's' : ''}
                  {' · '}
                  Reçu : {formatNumber(ligne.qte_recue)} paire
                  {ligne.qte_recue !== 1 ? 's' : ''}
                </p>
                {ligne.qte_manquante > 0 && (
                  <p className="mt-1 text-sm font-semibold text-danger">
                    Manque : {formatNumber(ligne.qte_manquante)} paire
                    {ligne.qte_manquante !== 1 ? 's' : ''} — {formatDa(ligne.valeur_manquante)}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  if (!USE_SUPABASE) {
    return (
      <PageSurface className="space-y-6">
        <PageHeader
          eyebrow="Espace fournisseur"
          title="Portail fournisseur"
          description="Suivi de vos envois et notifications."
        />
        <EmptyBlock
          icon={AlertCircle}
          title="Supabase requis"
          description="Le portail fournisseur nécessite Supabase."
        />
      </PageSurface>
    );
  }

  if (!fournisseurId) {
    return (
      <PageSurface className="space-y-6">
        <PageHeader
          eyebrow="Espace fournisseur"
          title="Portail fournisseur"
          description="Suivi de vos envois et notifications."
        />
        <div className="mx-auto flex min-h-[280px] max-w-md items-center">
          <div className="w-full rounded-lg border border-border/80 bg-card px-6 py-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--warning))]" />
            <p className="font-display text-base font-semibold">Compte non configuré</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre compte fournisseur n&apos;est pas encore rattaché à un fournisseur.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Veuillez contacter l&apos;administrateur pour associer votre compte à un
              fournisseur.
            </p>
          </div>
        </div>
      </PageSurface>
    );
  }

  const fournisseurNom = dashboard?.fournisseur_nom || user?.name || user?.username || 'Fournisseur';

  return (
    <PageSurface className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Espace fournisseur"
        title={fournisseurNom}
        description={`Bienvenue, ${user?.name || user?.username || 'fournisseur'} — gérez vos envois et suivez vos validations.`}
        actions={
          unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[hsl(var(--danger)/0.45)] text-danger"
              onClick={() => setActiveTab('notifications')}
            >
              <Bell className="mr-2 h-4 w-4" />
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </Button>
          ) : null
        }
      />

      {/* Navigation interne */}
      <nav
        className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
        aria-label="Navigation portail fournisseur"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className="relative shrink-0"
            >
              <Icon className="mr-1.5 h-4 w-4" />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-danger-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          );
        })}
      </nav>

      {/* Vue d'ensemble */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {loadingDashboard ? (
            <LoadingBlock label="Chargement du tableau de bord…" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <MetaStat
                      label="Paires envoyées"
                      value={formatNumber(dashboard?.paires_envoyees)}
                      tone="info"
                    />
                    <Package className="h-7 w-7 shrink-0 text-primary/40" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <MetaStat
                      label="Paires reçues"
                      value={formatNumber(dashboard?.paires_recues)}
                      tone="success"
                    />
                    <TrendingUp className="h-7 w-7 shrink-0 text-success/40" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <MetaStat
                      label="Paires manquantes"
                      value={`${formatNumber(dashboard?.paires_manquantes)} paire${
                        Number(dashboard?.paires_manquantes || 0) !== 1 ? 's' : ''
                      }`}
                      tone="warning"
                      hint={formatDa(dashboard?.valeur_manquante)}
                    />
                    <TrendingDown className="h-7 w-7 shrink-0 text-[hsl(var(--warning)/0.45)]" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 border-[hsl(var(--info)/0.35)] bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <MetaStat
                      label="Montant dû"
                      value={formatDa(dashboard?.montant_du)}
                      tone="info"
                    />
                    <DollarSign className="h-7 w-7 shrink-0 text-primary/40" />
                  </div>
                </div>
              </div>

              <section className="rounded-lg border border-border/80 bg-card p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold tracking-tight">
                      Détail financier
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Synthèse des valeurs et paiements
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Valeur reçue</span>
                    <span className="font-semibold tabular-nums text-success">
                      {formatDa(dashboard?.valeur_recue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Valeur manquante</span>
                    <span className="font-semibold tabular-nums text-[hsl(var(--warning))]">
                      {formatDa(dashboard?.valeur_manquante)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Déjà payé</span>
                    <span className="font-semibold tabular-nums">
                      {formatDa(dashboard?.total_paye)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Montant qui vous est dû</span>
                    <span className="text-lg font-bold tabular-nums text-[hsl(var(--info))]">
                      {formatDa(dashboard?.montant_du)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('mes-envois')}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Voir mes envois
                  </Button>
                  <Button type="button" size="sm" onClick={() => setActiveTab('envoi')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un envoi
                  </Button>
                </div>
              </section>

              {/* Indicateurs secondaires (icônes) — mêmes chiffres dashboard */}
              <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Envoyé
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-success" /> Reçu
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /> Manquant
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mes envois */}
      {activeTab === 'mes-envois' && (
        <div className="space-y-5">
          {loadingEnvois ? (
            <LoadingBlock label="Chargement de vos envois…" />
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                    <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold tracking-tight">
                      En attente
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Envoi soumis, en attente de validation à la réception
                    </p>
                  </div>
                </div>

                {envoisEnAttente.length === 0 ? (
                  <EmptyBlock
                    icon={Clock}
                    title="Aucun envoi en attente"
                    description="Les nouveaux envois apparaîtront ici jusqu’à validation."
                  />
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2.5 font-medium">Date</th>
                            <th className="px-3 py-2.5 font-medium">Statut</th>
                            <th className="px-3 py-2.5 font-medium">Lignes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {envoisEnAttente.map((envoi) => (
                            <tr
                              key={envoi.entree_id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-3 py-3 align-top font-medium">
                                {formatDate(envoi.date_envoi)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {getStatutBadge(envoi.statut)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <ul className="space-y-1.5">
                                  {envoi.lignes.map((ligne, idx) => (
                                    <li key={idx}>
                                      <span className="font-medium">
                                        {ligne.reference ? `${ligne.reference} · ` : ''}
                                        {ligne.produit_nom}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {' '}
                                        — {formatNumber(ligne.qte_envoyee)}{' '}
                                        {ligne.qte_envoyee !== 1
                                          ? 'paires envoyées'
                                          : 'paire envoyée'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {envoisEnAttente.map((envoi) => renderEnvoiCard(envoi, false))}
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                    <CheckCheck className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold tracking-tight">
                      Traités
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Envoi traité à la réception (validé ou litige)
                    </p>
                  </div>
                </div>

                {envoisValides.length === 0 ? (
                  <EmptyBlock
                    icon={CheckCheck}
                    title="Aucun envoi traité"
                    description="Les envois validés ou en litige apparaîtront ici."
                  />
                ) : (
                  <>
                    <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2.5 font-medium">Date</th>
                            <th className="px-3 py-2.5 font-medium">Statut</th>
                            <th className="px-3 py-2.5 font-medium">Lignes & écarts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {envoisValides.map((envoi) => (
                            <tr
                              key={envoi.entree_id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-3 py-3 align-top font-medium">
                                {formatDate(envoi.date_envoi)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {getStatutBadge(envoi.statut)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <ul className="space-y-2">
                                  {envoi.lignes.map((ligne, idx) => (
                                    <li key={idx} className="space-y-0.5">
                                      <p className="font-medium">
                                        {ligne.reference ? `${ligne.reference} · ` : ''}
                                        {ligne.produit_nom}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Envoyé : {formatNumber(ligne.qte_envoyee)} paire
                                        {ligne.qte_envoyee !== 1 ? 's' : ''}
                                        {' · '}
                                        Reçu : {formatNumber(ligne.qte_recue)} paire
                                        {ligne.qte_recue !== 1 ? 's' : ''}
                                      </p>
                                      {ligne.qte_manquante > 0 && (
                                        <p className="text-sm font-semibold text-danger">
                                          Manque : {formatNumber(ligne.qte_manquante)} paire
                                          {ligne.qte_manquante !== 1 ? 's' : ''} —{' '}
                                          {formatDa(ligne.valeur_manquante)}
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {envoisValides.map((envoi) => renderEnvoiCard(envoi, true))}
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* Créer un envoi */}
      {activeTab === 'envoi' && (
        <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Nouvel envoi
              </h2>
              <p className="text-xs text-muted-foreground">
                Uniquement vos produits assignés — indiquez les quantités envoyées.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="envoi-date">
              Date d&apos;envoi *
            </label>
            <Input
              id="envoi-date"
              type="date"
              value={envoiForm.date}
              onChange={(e) => setEnvoiForm({ ...envoiForm, date: e.target.value })}
              className="h-9 max-w-xs"
            />
          </div>

          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="envoi-produit">
                Produit *
              </label>
              <select
                id="envoi-produit"
                value={currentLigne.produitId}
                onChange={(e) =>
                  setCurrentLigne({ ...currentLigne, produitId: e.target.value })
                }
                disabled={loadingProduits}
                className={SELECT_CLASS}
              >
                <option value="">Sélectionner un produit</option>
                {produitsAssignes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatProduitOption(p)}
                  </option>
                ))}
              </select>
              {!loadingProduits && produitsAssignes.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucun produit assigné — contactez l&apos;administrateur.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="envoi-quantite"
              >
                Quantité *
              </label>
              <Input
                id="envoi-quantite"
                type="number"
                min="1"
                value={currentLigne.quantite}
                onChange={(e) =>
                  setCurrentLigne({ ...currentLigne, quantite: e.target.value })
                }
                placeholder="Ex: 50"
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleAddLigne}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter la ligne
            </Button>
          </div>

          {envoiForm.lignes.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Lignes de l&apos;envoi ({envoiForm.lignes.length})
              </p>

              {/* Desktop récap */}
              <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Produit</th>
                      <th className="px-3 py-2.5 text-right font-medium">Qté</th>
                      <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                      <th className="px-3 py-2.5 text-right font-medium">Sous-total</th>
                      <th className="w-12 px-3 py-2.5 text-right font-medium">
                        <span className="sr-only">Retirer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {envoiForm.lignes.map((ligne, index) => {
                      const sousTotal = ligne.quantite * (ligne.prixAchat || 0);
                      return (
                        <tr
                          key={`${ligne.produitId}-${index}`}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="px-3 py-2.5 font-medium">
                            {ligne.produitReference
                              ? `${ligne.produitReference} · ${ligne.produitNom}`
                              : ligne.produitNom}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatNumber(ligne.quantite)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatDa(ligne.prixAchat)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {formatDa(sousTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRemoveLigne(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
                {envoiForm.lignes.map((ligne, index) => {
                  const sousTotal = ligne.quantite * (ligne.prixAchat || 0);
                  return (
                    <div
                      key={`${ligne.produitId}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {ligne.produitReference
                            ? `${ligne.produitReference} · ${ligne.produitNom}`
                            : ligne.produitNom}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatNumber(ligne.quantite)} paires × {formatDa(ligne.prixAchat)} ={' '}
                          <span className="font-semibold text-foreground">
                            {formatDa(sousTotal)}
                          </span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveLigne(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/80 pt-3">
                <span className="font-semibold">Total de l&apos;envoi</span>
                <span className="text-lg font-bold tabular-nums">{formatDa(envoiTotal)}</span>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={handleSubmitEnvoi}
              disabled={submitting || envoiForm.lignes.length === 0}
              className="sm:min-w-[200px]"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {submitting ? 'Envoi en cours…' : "Soumettre l'envoi"}
            </Button>
          </div>
        </section>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <section className="space-y-4 rounded-lg border border-border/80 bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Notifications
                </h2>
                <p className="text-xs text-muted-foreground">
                  Alertes et litiges concernant vos envois
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <StatusBadge
                status="litige"
                label={`${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`}
              />
            )}
          </div>

          {loadingNotifications ? (
            <LoadingBlock label="Chargement…" />
          ) : notifications.length === 0 ? (
            <EmptyBlock
              icon={Bell}
              title="Aucune notification"
              description="Les alertes de litige ou de manquants apparaîtront ici."
            />
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'rounded-lg border border-border/80 px-3 py-3 sm:px-4',
                    notif.lu
                      ? 'opacity-70'
                      : 'border-[hsl(var(--info)/0.45)] bg-[hsl(var(--info)/0.06)]'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={notif.lu ? 'info' : 'en_attente'}
                          label={notif.type || 'info'}
                        />
                        {!notif.lu && <StatusBadge status="litige" label="Nouveau" />}
                        <span className="text-xs text-muted-foreground">
                          {notif.created_at
                            ? new Date(notif.created_at).toLocaleString('fr-FR')
                            : ''}
                        </span>
                      </div>
                      <p className="text-sm">{notif.message || '—'}</p>
                      {notif.paires_manquantes != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notif.paires_manquantes} paire(s) manquante(s)
                        </p>
                      )}
                      {notif.montant_manque != null &&
                        parseFloat(notif.montant_manque) > 0 && (
                          <p className="mt-2 text-sm font-semibold text-danger">
                            Manque : {formatDa(notif.montant_manque)}
                          </p>
                        )}
                    </div>
                    {!notif.lu && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkRead(notif.id)}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Marquer comme lue
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </PageSurface>
  );
};

export default SupplierPortal;
