import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  ListChecks,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
};

const calcValeurTotale = (lignes) =>
  (lignes || []).reduce(
    (sum, l) => sum + (parseInt(l.quantite_recue, 10) || 0) * (parseFloat(l.prix_achat) || 0),
    0
  );

const getStatutBadge = (statut) => {
  if (statut === 'litige') {
    return <Badge variant="destructive">Litige</Badge>;
  }
  return <Badge className="bg-green-600 hover:bg-green-600">Validé</Badge>;
};

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

  if (!USE_SUPABASE) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Cette section nécessite Supabase.
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin()) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Accès restreint</CardTitle>
          <CardDescription>Réservé aux administrateurs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (screen === 'detail' && selectedEntree) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="outline" onClick={backToList}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la liste
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedEntree.fournisseur_nom || 'Fournisseur'}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 mt-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(selectedEntree.date)}
                  {getStatutBadge(selectedEntree.statut)}
                  <Badge variant={selectedEntree.paye ? 'default' : 'secondary'}>
                    {selectedEntree.paye ? 'Payé' : 'Non payé'}
                  </Badge>
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valeur (qté reçue)</p>
                <p className="text-2xl font-bold text-primary">{formatDa(liveValeur)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Lignes de l&apos;entrée</h3>
              {editLignes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune ligne — ajoutez un produit ci-dessous.
                </p>
              ) : (
                editLignes.map((ligne) => (
                  <Card key={ligne._key} className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2 items-start">
                        <div>
                          <p className="font-medium">
                            {ligne.reference ? `${ligne.reference} · ` : ''}
                            {ligne.produit_nom}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Prix achat : {formatDa(ligne.prix_achat)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLigne(ligne)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Quantité envoyée</label>
                          <Input
                            type="number"
                            min="0"
                            value={ligne.quantite}
                            onChange={(e) => handleLigneChange(ligne._key, 'quantite', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Quantité reçue</label>
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
                      <p className="text-sm text-muted-foreground">
                        Sous-total reçu :{' '}
                        <span className="font-semibold text-foreground">
                          {formatDa((ligne.quantite_recue || 0) * (ligne.prix_achat || 0))}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium mb-1 block">Produit</label>
                  <select
                    value={newLigne.produitId}
                    onChange={(e) => setNewLigne({ ...newLigne, produitId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sélectionner…</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference ? `${p.reference} · ` : ''}{p.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Qté envoyée</label>
                  <Input
                    type="number"
                    min="1"
                    value={newLigne.quantite}
                    onChange={(e) => setNewLigne({ ...newLigne, quantite: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Qté reçue</label>
                  <Input
                    type="number"
                    min="0"
                    value={newLigne.quantite_recue}
                    onChange={(e) => setNewLigne({ ...newLigne, quantite_recue: e.target.value })}
                  />
                </div>
              </div>
              <Button type="button" variant="outline" onClick={handleAddLigne}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter la ligne
              </Button>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total entrée (quantité reçue × prix)</p>
                <p className="text-xl font-bold">{formatDa(liveValeur)}</p>
              </div>
              <Button type="button" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <ListChecks className="h-8 w-8" />
          Entrées validées
        </h1>
        <p className="text-muted-foreground mt-1">
          Consultez et modifiez les entrées validées ou en litige
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Chargement…
          </CardContent>
        </Card>
      ) : entrees.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune entrée validée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entrees.map((entree) => {
            const valeur = calcValeurTotale(entree.lignes);
            return (
              <Card
                key={entree.entree_id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openDetail(entree)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {entree.fournisseur_nom || 'Fournisseur'}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(entree.date)}
                        <span>·</span>
                        {entree.lignes?.length || 0} ligne{(entree.lignes?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatutBadge(entree.statut)}
                      <Badge variant={entree.paye ? 'default' : 'outline'}>
                        {entree.paye ? 'Payé' : 'Non payé'}
                      </Badge>
                      <span className="font-bold text-primary ml-2">{formatDa(valeur)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ValidatedEntries;
