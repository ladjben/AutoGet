import { useState, useEffect, useMemo } from 'react';
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
  Package,
  UserPlus,
  Search,
  Building2,
  Check,
  X,
  AlertCircle,
  Link2,
} from 'lucide-react';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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

  const [compteForm, setCompteForm] = useState({
    nom: '',
    role: 'fournisseur',
    username: '',
    password: '',
    fournisseur_id: '',
  });
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

      setCompteForm({
        nom: '',
        role: 'fournisseur',
        username: '',
        password: '',
        fournisseur_id: '',
      });
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

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accès restreint</CardTitle>
            <CardDescription>Cette section est réservée aux administrateurs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!USE_SUPABASE) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center text-muted-foreground">
          La gestion des accès fournisseurs nécessite Supabase.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Accès Fournisseurs</h1>
        <p className="text-muted-foreground mt-1">
          Assignation de produits et création de comptes fournisseur / employé
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Carte 1 : Assigner des produits */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Assigner des produits
            </CardTitle>
            <CardDescription>
              Choisissez un fournisseur puis activez les produits qu&apos;il peut envoyer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fournisseur *</label>
              <select
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher un produit (nom, référence)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                disabled={!selectedFournisseurId}
              />
            </div>

            {selectedFournisseurId && (
              <p className="text-xs text-muted-foreground">
                {assignedCount} / {filteredProduits.length} produit(s) assigné(s)
                {searchQuery ? ' (filtrés)' : ''}
              </p>
            )}

            <Separator />

            {!selectedFournisseurId ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez un fournisseur pour gérer ses produits</p>
              </div>
            ) : loadingAssignations ? (
              <p className="text-center text-muted-foreground py-8">Chargement…</p>
            ) : filteredProduits.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun produit trouvé</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredProduits.map((produit) => {
                  const isAssigned = assignedProduitIds.has(produit.id);
                  const isToggling = togglingId === produit.id;
                  return (
                    <Card
                      key={produit.id}
                      className={`transition-colors ${
                        isAssigned
                          ? 'border-green-500/60 bg-green-50/50 dark:bg-green-950/20'
                          : 'border-border'
                      }`}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{produit.nom}</span>
                            {isAssigned && (
                              <Badge className="bg-green-600 text-xs">Assigné</Badge>
                            )}
                          </div>
                          {produit.reference && (
                            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                              Réf. {produit.reference}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isAssigned ? 'outline' : 'default'}
                          disabled={isToggling}
                          onClick={() => handleToggleAssignation(produit.id)}
                          className={
                            isAssigned
                              ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : ''
                          }
                        >
                          {isToggling ? (
                            '…'
                          ) : isAssigned ? (
                            <>
                              <X className="h-3.5 w-3.5 mr-1" />
                              Retirer
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Assigner
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carte 2 : Créer un compte */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Créer un compte
            </CardTitle>
            <CardDescription>
              Compte fournisseur (portail envoi) ou employé (validation réception)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom affiché *</label>
              <Input
                value={compteForm.nom}
                onChange={(e) => setCompteForm({ ...compteForm, nom: e.target.value })}
                placeholder="Ex: Ahmed Fournisseur"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Rôle *</label>
              <select
                value={compteForm.role}
                onChange={(e) =>
                  setCompteForm({
                    ...compteForm,
                    role: e.target.value,
                    fournisseur_id: e.target.value === 'fournisseur' ? compteForm.fournisseur_id : '',
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="fournisseur">Fournisseur</option>
                <option value="employe">Employé</option>
              </select>
            </div>

            {compteForm.role === 'fournisseur' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Fournisseur lié *</label>
                <select
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

            <div>
              <label className="text-sm font-medium mb-2 block">Identifiant *</label>
              <Input
                value={compteForm.username}
                onChange={(e) => setCompteForm({ ...compteForm, username: e.target.value })}
                placeholder="nom.utilisateur"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Mot de passe *</label>
              <Input
                type="password"
                value={compteForm.password}
                onChange={(e) => setCompteForm({ ...compteForm, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="flex gap-2 items-start rounded-md border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Les mots de passe sont stockés en clair pour l&apos;instant. À migrer vers
                un hachage sécurisé en production.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleCreateCompte}
              disabled={creatingCompte}
              className="w-full"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {creatingCompte ? 'Création…' : 'Créer le compte'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupplierAccess;
