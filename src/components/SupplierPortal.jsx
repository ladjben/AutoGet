import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../context/UnifiedDataContext';
import { useAuth } from '../context/AuthContext';
import { USE_SUPABASE } from '../config';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'envoi', label: 'Créer un envoi', icon: Package },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');

const formatDa = (value) => `${formatNumber(parseFloat(value || 0).toFixed(2))} DA`;

const SupplierPortal = () => {
  const dataCtx = useData();
  const { user } = useAuth();
  const { toast } = useToast();

  const fournisseurId = user?.fournisseur_id ?? null;

  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [produitsAssignes, setProduitsAssignes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingProduits, setLoadingProduits] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [envoiForm, setEnvoiForm] = useState({
    date: new Date().toISOString().split('T')[0],
    lignes: [],
  });
  const [currentLigne, setCurrentLigne] = useState({ produitId: '', quantite: '' });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.lu).length,
    [notifications]
  );

  const loadDashboard = useCallback(async () => {
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
  }, [fournisseurId, dataCtx, toast]);

  const loadProduitsAssignes = useCallback(async () => {
    if (!fournisseurId || !dataCtx?.fetchProduitsAssignes) return;
    setLoadingProduits(true);
    try {
      const data = await dataCtx.fetchProduitsAssignes(fournisseurId);
      setProduitsAssignes(data || []);
    } catch (e) {
      console.error('Erreur chargement produits assignés:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les produits',
      });
    } finally {
      setLoadingProduits(false);
    }
  }, [fournisseurId, dataCtx, toast]);

  const loadNotifications = useCallback(async () => {
    if (!fournisseurId || !dataCtx?.fetchNotifications) return;
    setLoadingNotifications(true);
    try {
      const data = await dataCtx.fetchNotifications(fournisseurId);
      setNotifications(data || []);
    } catch (e) {
      console.error('Erreur chargement notifications:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de charger les notifications',
      });
    } finally {
      setLoadingNotifications(false);
    }
  }, [fournisseurId, dataCtx, toast]);

  useEffect(() => {
    if (!fournisseurId || !USE_SUPABASE) return;
    loadDashboard();
    loadProduitsAssignes();
    loadNotifications();
  }, [fournisseurId, loadDashboard, loadProduitsAssignes, loadNotifications]);

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
      await loadDashboard();
      setActiveTab('overview');
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

  if (!USE_SUPABASE) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Le portail fournisseur nécessite Supabase.
        </CardContent>
      </Card>
    );
  }

  if (!fournisseurId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Compte non configuré
            </CardTitle>
            <CardDescription>
              Votre compte fournisseur n&apos;est pas encore rattaché à un fournisseur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Veuillez contacter l&apos;administrateur pour associer votre compte à un fournisseur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Portail Fournisseur</h1>
          <p className="text-muted-foreground mt-1">
            Bienvenue, {user?.name || user?.username}
            {dashboard?.fournisseur_nom ? ` — ${dashboard.fournisseur_nom}` : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className="relative"
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Onglet 1 : Vue d'ensemble */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loadingDashboard ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Chargement du tableau de bord…
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Paires envoyées</p>
                        <p className="text-2xl font-bold">{formatNumber(dashboard?.paires_envoyees)}</p>
                      </div>
                      <Package className="h-8 w-8 text-primary/40" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Paires reçues</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatNumber(dashboard?.paires_recues)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500/40" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Paires manquantes</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatNumber(dashboard?.paires_manquantes)} paire
                          {Number(dashboard?.paires_manquantes || 0) !== 1 ? 's' : ''}
                        </p>
                        <p className="text-sm font-medium text-orange-600/90 mt-1">
                          {formatDa(dashboard?.valeur_manquante)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-orange-500/40" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Montant dû</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatDa(dashboard?.montant_du)}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-primary/40" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Détail financier</CardTitle>
                  <CardDescription>Synthèse des valeurs et paiements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valeur reçue</span>
                    <span className="font-semibold text-green-600">
                      {formatDa(dashboard?.valeur_recue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valeur manquante</span>
                    <span className="font-semibold text-orange-600">
                      {formatDa(dashboard?.valeur_manquante)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Déjà payé</span>
                    <span className="font-semibold">{formatDa(dashboard?.total_paye)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Montant qui vous est dû</span>
                    <span className="text-lg font-bold text-primary">
                      {formatDa(dashboard?.montant_du)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Onglet 2 : Créer un envoi */}
      {activeTab === 'envoi' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Nouvel envoi
            </CardTitle>
            <CardDescription>
              Sélectionnez vos produits assignés et indiquez les quantités envoyées
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Date d&apos;envoi *</label>
              <Input
                type="date"
                value={envoiForm.date}
                onChange={(e) => setEnvoiForm({ ...envoiForm, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Produit *</label>
                <select
                  value={currentLigne.produitId}
                  onChange={(e) => setCurrentLigne({ ...currentLigne, produitId: e.target.value })}
                  disabled={loadingProduits}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Sélectionner un produit</option>
                  {produitsAssignes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}{p.reference ? ` (${p.reference})` : ''}
                    </option>
                  ))}
                </select>
                {!loadingProduits && produitsAssignes.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aucun produit assigné — contactez l&apos;administrateur.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Quantité *</label>
                <Input
                  type="number"
                  min="1"
                  value={currentLigne.quantite}
                  onChange={(e) => setCurrentLigne({ ...currentLigne, quantite: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
            </div>

            <Button type="button" variant="outline" onClick={handleAddLigne}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter la ligne
            </Button>

            {envoiForm.lignes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Lignes de l&apos;envoi ({envoiForm.lignes.length})</p>
                {envoiForm.lignes.map((ligne, index) => (
                  <Card key={`${ligne.produitId}-${index}`} className="bg-muted/30">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{ligne.produitNom}</p>
                        <p className="text-sm text-muted-foreground">{ligne.quantite} paire(s)</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLigne(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Separator />

            <Button
              type="button"
              onClick={handleSubmitEnvoi}
              disabled={submitting || envoiForm.lignes.length === 0}
              className="w-full sm:w-auto"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Envoi en cours…' : 'Soumettre l\'envoi'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Onglet 3 : Notifications */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>Alertes et litiges concernant vos envois</CardDescription>
              </div>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingNotifications ? (
              <p className="text-center text-muted-foreground py-8">Chargement…</p>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <Card
                    key={notif.id}
                    className={notif.lu ? 'opacity-70' : 'border-primary/30 bg-primary/5'}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap justify-between gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={notif.lu ? 'outline' : 'default'}>
                              {notif.type || 'info'}
                            </Badge>
                            {!notif.lu && (
                              <Badge variant="secondary" className="text-xs">Nouveau</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {notif.created_at
                                ? new Date(notif.created_at).toLocaleString('fr-FR')
                                : ''}
                            </span>
                          </div>
                          <p className="text-sm">{notif.message || '—'}</p>
                          {notif.paires_manquantes != null && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {notif.paires_manquantes} paire(s) manquante(s)
                            </p>
                          )}
                          {notif.montant_manque != null && parseFloat(notif.montant_manque) > 0 && (
                            <p className="text-sm font-semibold text-red-600 mt-2">
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
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Marquer lu
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupplierPortal;
