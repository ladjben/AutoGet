import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useMemo, useState, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Package, TrendingDown, TrendingUp, DollarSign, CreditCard, ShoppingCart } from 'lucide-react';

const Dashboard = () => {
  const dataCtx = useData();
  const { isAdmin } = useAuth();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? []
  };
  const { toast } = useToast();

  // État pour stocker les détails des entrées (lignes) en mode Supabase
  const [entreesDetails, setEntreesDetails] = useState({});

  // Charger les détails de toutes les entrées en mode Supabase
  useEffect(() => {
    if (USE_SUPABASE && dataCtx?.fetchEntreeDetails && state.entrees?.length > 0) {
      const loadAllEntreesDetails = async () => {
        const details = {};
        for (const entree of state.entrees) {
          try {
            const lignes = await dataCtx.fetchEntreeDetails(entree.id);
            details[entree.id] = lignes || [];
          } catch (e) {
            console.error(`Erreur chargement détails entrée ${entree.id}:`, e);
            details[entree.id] = [];
          }
        }
        setEntreesDetails(details);
      };
      loadAllEntreesDetails();
    }
  }, [USE_SUPABASE, state.entrees, dataCtx?.fetchEntreeDetails]);

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cosmos-algerie-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export réussi",
      description: "Les données ont été exportées avec succès",
    });
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = (state.fournisseurs || []).find(f => {
      const fId = f.id;
      const entreeFId = fournisseurId?.fournisseur_id ?? fournisseurId?.fournisseurId ?? fournisseurId;
      return fId === entreeFId;
    });
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  // Calculer TOUTES les statistiques disponibles
  const allStats = useMemo(() => {
    const produits = state.produits || [];
    const fournisseurs = state.fournisseurs || [];
    const entrees = state.entrees || [];
    const paiements = state.paiements || [];
    const depenses = state.depenses || [];

    // ========== PRODUITS ==========
    const totalProduits = produits.length;
    const valeurTotaleProduits = produits.reduce((sum, p) => {
      return sum + (p.prix_achat ?? p.prixAchat ?? 0);
    }, 0);
    const prixMoyenProduits = totalProduits > 0 ? valeurTotaleProduits / totalProduits : 0;
    const produitsAvecReference = produits.filter(p => p.reference && p.reference.trim()).length;

    // ========== FOURNISSEURS ==========
    const totalFournisseurs = fournisseurs.length;
    
    // ========== ENTRÉES ==========
    const totalEntrees = entrees.length;
    let totalValeurEntrees = 0;
    let totalValeurEntreesPayees = 0;
    let totalValeurEntreesNonPayees = 0;
    let totalEntreesPayees = 0;
    let totalEntreesNonPayees = 0;
    let totalProduitsReçus = 0;
    
    entrees.forEach(entree => {
      let entreeValue = 0;
      let produitsCount = 0;
      
      // Mode local
      if (!USE_SUPABASE && entree.lignes) {
        entree.lignes.forEach(ligne => {
          const produit = produits.find(p => p.id === ligne.produitId);
          if (produit) {
            const prix = produit.prix_achat ?? produit.prixAchat ?? 0;
            entreeValue += ligne.quantite * prix;
            produitsCount += ligne.quantite || 0;
          }
        });
      } else if (USE_SUPABASE && entreesDetails[entree.id]) {
        // Mode Supabase : utiliser les détails chargés
        entreesDetails[entree.id].forEach(ligne => {
          const prix = ligne.produit_id?.prix_achat ?? 0;
          entreeValue += (ligne.quantite || 0) * prix;
          produitsCount += ligne.quantite || 0;
        });
      }
      
      totalValeurEntrees += entreeValue;
      totalProduitsReçus += produitsCount;
      
      const paye = Boolean(entree.paye);
      if (paye) {
        totalEntreesPayees++;
        totalValeurEntreesPayees += entreeValue;
      } else {
        totalEntreesNonPayees++;
        totalValeurEntreesNonPayees += entreeValue;
      }
    });

    // ========== PAIEMENTS ==========
    const totalPaiements = paiements.length;
    const totalMontantPaiements = paiements.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
    const moyennePaiement = totalPaiements > 0 ? totalMontantPaiements / totalPaiements : 0;

    // ========== DÉPENSES ==========
    const totalDepenses = depenses.length;
    const totalMontantDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0);
    const moyenneDepense = totalDepenses > 0 ? totalMontantDepenses / totalDepenses : 0;
    
    // Groupement par catégorie
    const depensesParCategorie = {};
    depenses.forEach(d => {
      const nom = d.depense_categories?.nom || d.nom || 'Sans catégorie';
      if (!depensesParCategorie[nom]) {
        depensesParCategorie[nom] = { count: 0, total: 0 };
      }
      depensesParCategorie[nom].count++;
      depensesParCategorie[nom].total += d.montant || 0;
    });
    const nombreCategories = Object.keys(depensesParCategorie).length;

    // ========== CALCULS FINANCIERS ==========
    const soldeGlobal = totalMontantPaiements - totalValeurEntreesNonPayees;
    const tauxPaiementEntrees = totalValeurEntrees > 0 ? (totalValeurEntreesPayees / totalValeurEntrees) * 100 : 0;
    const tauxEntreesPayees = totalEntrees > 0 ? (totalEntreesPayees / totalEntrees) * 100 : 0;

    // ========== DATES ==========
    const entreesRecent = entrees.slice(-5).reverse();
    const paiementsRecent = paiements.slice(-5).reverse();
    const depensesRecent = depenses.slice(-5).reverse();

    return {
      // Produits
      totalProduits,
      valeurTotaleProduits,
      prixMoyenProduits,
      produitsAvecReference,
      
      // Fournisseurs
      totalFournisseurs,
      
      // Entrées
      totalEntrees,
      totalValeurEntrees,
      totalValeurEntreesPayees,
      totalValeurEntreesNonPayees,
      totalEntreesPayees,
      totalEntreesNonPayees,
      totalProduitsReçus,
      
      // Paiements
      totalPaiements,
      totalMontantPaiements,
      moyennePaiement,
      
      // Dépenses
      totalDepenses,
      totalMontantDepenses,
      moyenneDepense,
      nombreCategories,
      depensesParCategorie,
      
      // Calculs financiers
      soldeGlobal,
      tauxPaiementEntrees,
      tauxEntreesPayees,
      
      // Récents
      entreesRecent,
      paiementsRecent,
      depensesRecent
    };
  }, [state, entreesDetails]);

  // Statistiques par période
  const periodStats = useMemo(() => {
    const entrees = state.entrees || [];
    const paiements = state.paiements || [];
    const depenses = state.depenses || [];
    
    const todayEntrees = filterByPeriod(entrees, 'date', 'today');
    const weekEntrees = filterByPeriod(entrees, 'date', 'week');
    const monthEntrees = filterByPeriod(entrees, 'date', 'month');
    
    const todayPaiements = filterByPeriod(paiements, 'date', 'today');
    const weekPaiements = filterByPeriod(paiements, 'date', 'week');
    const monthPaiements = filterByPeriod(paiements, 'date', 'month');
    
    const todayDepenses = filterByPeriod(depenses, 'date', 'today');
    const weekDepenses = filterByPeriod(depenses, 'date', 'week');
    const monthDepenses = filterByPeriod(depenses, 'date', 'month');
    
    const calcEntrees = (items) => ({
      count: items.length,
      payees: items.filter(e => e.paye).length,
      nonPayees: items.filter(e => !e.paye).length
    });
    
    const calcPaiements = (items) => ({
      count: items.length,
      total: items.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0),
    });
    
    const calcDepenses = (items) => ({
      count: items.length,
      total: items.reduce((sum, d) => sum + (d.montant || 0), 0),
    });
    
    return {
      today: {
        entrees: calcEntrees(todayEntrees),
        paiements: calcPaiements(todayPaiements),
        depenses: calcDepenses(todayDepenses)
      },
      week: {
        entrees: calcEntrees(weekEntrees),
        paiements: calcPaiements(weekPaiements),
        depenses: calcDepenses(weekDepenses)
      },
      month: {
        entrees: calcEntrees(monthEntrees),
        paiements: calcPaiements(monthPaiements),
        depenses: calcDepenses(monthDepenses)
      }
    };
  }, [state.entrees, state.paiements, state.depenses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter les Données
        </Button>
      </div>

      {/* Vue d'Ensemble Globale - Admin seulement */}
      {isAdmin() && (
      <Card>
        <CardHeader>
          <CardTitle>Vue d'Ensemble Globale</CardTitle>
          <CardDescription>Statistiques complètes de votre activité</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cartes principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valeur Stock Total</p>
                    <p className="text-3xl font-bold">{allStats.totalValeurEntrees.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allStats.totalProduitsReçus} produits reçus
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dû aux Fournisseurs</p>
                    <p className="text-3xl font-bold text-destructive">{allStats.totalValeurEntreesNonPayees.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allStats.totalEntreesNonPayees} entrées non payées
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Payé</p>
                    <p className="text-3xl font-bold text-green-600">{allStats.totalMontantPaiements.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allStats.totalPaiements} paiements effectués
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Dépenses</p>
                    <p className="text-3xl font-bold">{allStats.totalMontantDepenses.toFixed(2)} DA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allStats.totalDepenses} dépenses enregistrées
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Statistiques détaillées */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Produits</p>
              <p className="text-xl font-bold">{allStats.totalProduits}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Entrées</p>
              <p className="text-xl font-bold">{allStats.totalEntrees}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Entrées Payées</p>
              <p className="text-xl font-bold text-green-600">{allStats.totalEntreesPayees}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Entrées Non Payées</p>
              <p className="text-xl font-bold text-destructive">{allStats.totalEntreesNonPayees}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Fournisseurs</p>
              <p className="text-xl font-bold">{allStats.totalFournisseurs}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Taux Paiement</p>
              <p className="text-xl font-bold">{allStats.tauxPaiementEntrees.toFixed(1)}%</p>
            </div>
          </div>

          <Separator />

          {/* Statistiques financières */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valeur Entrées Payées</p>
              <p className="text-xl font-bold">{allStats.totalValeurEntreesPayees.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Moyenne Paiement</p>
              <p className="text-xl font-bold">{allStats.moyennePaiement.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Moyenne Dépense</p>
              <p className="text-xl font-bold">{allStats.moyenneDepense.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Solde Global</p>
              <p className={`text-xl font-bold ${allStats.soldeGlobal >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {allStats.soldeGlobal.toFixed(2)} DA
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Prix Moyen Produits</p>
              <p className="text-xl font-bold">{allStats.prixMoyenProduits.toFixed(2)} DA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Taux Entrées Payées</p>
              <p className="text-xl font-bold">{allStats.tauxEntreesPayees.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Statistiques par Période - Visible pour tous */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par Période</CardTitle>
          <CardDescription>Vue détaillée par jour, semaine et mois</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Aujourd'hui */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aujourd'hui</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.today.entrees.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paiements:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.today.paiements.count} ({periodStats.today.paiements.total.toFixed(2)} DA)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dépenses:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.today.depenses.count} ({periodStats.today.depenses.total.toFixed(2)} DA)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Cette Semaine */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cette Semaine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.week.entrees.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paiements:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.week.paiements.count} ({periodStats.week.paiements.total.toFixed(2)} DA)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dépenses:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.week.depenses.count} ({periodStats.week.depenses.total.toFixed(2)} DA)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Ce Mois */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ce Mois</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrées:</span>
                  <span className="text-sm font-semibold">{periodStats.month.entrees.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paiements:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.month.paiements.count} ({periodStats.month.paiements.total.toFixed(2)} DA)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dépenses:</span>
                  <span className="text-sm font-semibold">
                    {periodStats.month.depenses.count} ({periodStats.month.depenses.total.toFixed(2)} DA)
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Produits - Visible pour tous */}
      <Card>
        <CardHeader>
          <CardTitle>Produits</CardTitle>
          <CardDescription>{allStats.totalProduits} produit(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Valeur Totale</p>
                <p className="text-2xl font-bold">{allStats.valeurTotaleProduits.toFixed(2)} DA</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Prix Moyen</p>
                <p className="text-2xl font-bold">{allStats.prixMoyenProduits.toFixed(2)} DA</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Avec Référence</p>
                <p className="text-2xl font-bold">{allStats.produitsAvecReference}</p>
              </CardContent>
            </Card>
          </div>
          {(state.produits || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun produit enregistré
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(state.produits || []).slice(0, 6).map((produit) => (
                <Card key={produit.id}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">{produit.nom}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Prix: {produit.prix_achat ?? produit.prixAchat ?? 0} DA
                    </p>
                    {produit.reference && (
                      <p className="text-xs text-muted-foreground mt-1">Réf: {produit.reference}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entrées Récentes */}
      <Card>
        <CardHeader>
          <CardTitle>Entrées Récentes</CardTitle>
          <CardDescription>{allStats.totalEntrees} entrée(s) au total</CardDescription>
        </CardHeader>
        <CardContent>
          {(state.entrees || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune entrée enregistrée
            </div>
          ) : (
            <div className="space-y-3">
              {allStats.entreesRecent.map((entree) => (
                <Card key={entree.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">Date: {entree.date}</p>
                        <p className="text-sm text-muted-foreground">
                          Fournisseur: {getFournisseurName(entree)}
                        </p>
                        {!USE_SUPABASE && entree.lignes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {entree.lignes.length} ligne(s) de produit
                          </p>
                        )}
                      </div>
                      <Badge variant={entree.paye ? "default" : "destructive"}>
                        {entree.paye ? 'Payé' : 'Non Payé'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paiements Récents */}
      <Card>
        <CardHeader>
          <CardTitle>Paiements Récents</CardTitle>
          <CardDescription>{allStats.totalPaiements} paiement(s) au total</CardDescription>
        </CardHeader>
        <CardContent>
          {(state.paiements || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun paiement enregistré
            </div>
          ) : (
            <div className="space-y-3">
              {allStats.paiementsRecent.map((paiement) => (
                <Card key={paiement.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {parseFloat(paiement.montant || 0).toFixed(2)} DA
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Fournisseur: {getFournisseurName(paiement.fournisseur_id ?? paiement.fournisseurId)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Date: {paiement.date}</p>
                        {paiement.description && (
                          <p className="text-xs text-muted-foreground mt-1">{paiement.description}</p>
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

      {/* Dépenses Récentes */}
      <Card>
        <CardHeader>
          <CardTitle>Dépenses Récentes</CardTitle>
          <CardDescription>
            {allStats.totalDepenses} dépense(s) - {allStats.nombreCategories} catégorie(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(state.depenses || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune dépense enregistrée
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {allStats.depensesRecent.map((depense) => (
                  <Card key={depense.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {depense.montant.toFixed(2)} DA
                          </p>
                          {(depense.nom || depense.depense_categories?.nom) && (
                            <Badge variant="outline" className="mt-2">
                              {depense.depense_categories?.nom || depense.nom}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">Date: {depense.date}</p>
                          {depense.description && (
                            <p className="text-xs text-muted-foreground mt-1">{depense.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {Object.keys(allStats.depensesParCategorie).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Répartition par Catégorie</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(allStats.depensesParCategorie).map(([nom, data]) => (
                        <Card key={nom}>
                          <CardContent className="pt-6 text-center">
                            <p className="text-xs text-muted-foreground font-medium">{nom}</p>
                            <p className="text-sm font-bold">{data.total.toFixed(2)} DA</p>
                            <p className="text-xs text-muted-foreground">{data.count} fois</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
