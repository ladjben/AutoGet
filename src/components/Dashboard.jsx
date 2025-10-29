import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useMemo } from 'react';
import { filterByPeriod } from '../utils/dateUtils';

const Dashboard = () => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? []
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `gestion-chaussures-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">📊 Tableau de Bord</h1>
        <button
          onClick={handleExport}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all flex items-center gap-2"
        >
          <span>📥</span>
          <span>Exporter les Données</span>
        </button>
      </div>

      {/* VUE D'ENSEMBLE PRINCIPALE */}
      <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="bg-white p-3 rounded-xl shadow-lg text-2xl">📊</span>
          <span>Vue d'Ensemble Globale</span>
        </h2>
        
        {/* Ligne 1: Cartes principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-blue-500 text-white p-3 rounded-xl text-2xl">📦</span>
              <span className="text-xs text-blue-700 font-semibold bg-blue-300 px-2 py-1 rounded-full">
                Valeur Stock Total
              </span>
            </div>
            <p className="text-3xl font-extrabold text-blue-800 mb-1">{allStats.totalValeurEntrees.toFixed(2)} DA</p>
            <p className="text-xs text-blue-600 mt-2">
              {allStats.totalProduitsReçus} produits reçus
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-red-100 to-red-200 border-3 border-red-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-red-500 text-white p-3 rounded-xl text-2xl">💸</span>
              <span className="text-xs text-red-700 font-semibold bg-red-300 px-2 py-1 rounded-full">
                Dû aux Fournisseurs
              </span>
            </div>
            <p className="text-3xl font-extrabold text-red-800 mb-1">{allStats.totalValeurEntreesNonPayees.toFixed(2)} DA</p>
            <p className="text-xs text-red-600 mt-2">
              {allStats.totalEntreesNonPayees} entrées non payées
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-green-500 text-white p-3 rounded-xl text-2xl">✅</span>
              <span className="text-xs text-green-700 font-semibold bg-green-300 px-2 py-1 rounded-full">
                Total Payé
              </span>
            </div>
            <p className="text-3xl font-extrabold text-green-800 mb-1">{allStats.totalMontantPaiements.toFixed(2)} DA</p>
            <p className="text-xs text-green-600 mt-2">
              {allStats.totalPaiements} paiements effectués
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-100 to-orange-200 border-3 border-orange-400 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-orange-500 text-white p-3 rounded-xl text-2xl">💰</span>
              <span className="text-xs text-orange-700 font-semibold bg-orange-300 px-2 py-1 rounded-full">
                Total Dépenses
              </span>
            </div>
            <p className="text-3xl font-extrabold text-orange-800 mb-1">{allStats.totalMontantDepenses.toFixed(2)} DA</p>
            <p className="text-xs text-orange-600 mt-2">
              {allStats.totalDepenses} dépenses enregistrées
            </p>
          </div>
        </div>

        {/* Ligne 2: Statistiques détaillées */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t-2 border-gray-400">
          <div className="bg-white/90 rounded-lg p-3 text-center border border-gray-300 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Total Produits</p>
            <p className="text-xl font-bold text-gray-900">{allStats.totalProduits}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border-2 border-blue-300 shadow-sm">
            <p className="text-xs text-blue-600 mb-1 font-medium">Total Entrées</p>
            <p className="text-xl font-bold text-blue-800">{allStats.totalEntrees}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border-2 border-green-300 shadow-sm">
            <p className="text-xs text-green-600 mb-1 font-medium">Entrées Payées</p>
            <p className="text-xl font-bold text-green-800">{allStats.totalEntreesPayees}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border-2 border-red-300 shadow-sm">
            <p className="text-xs text-red-600 mb-1 font-medium">Entrées Non Payées</p>
            <p className="text-xl font-bold text-red-800">{allStats.totalEntreesNonPayees}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center border-2 border-purple-300 shadow-sm">
            <p className="text-xs text-purple-600 mb-1 font-medium">Total Fournisseurs</p>
            <p className="text-xl font-bold text-purple-800">{allStats.totalFournisseurs}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center border-2 border-yellow-300 shadow-sm">
            <p className="text-xs text-yellow-700 mb-1 font-medium">Taux Paiement</p>
            <p className="text-xl font-bold text-yellow-800">{allStats.tauxPaiementEntrees.toFixed(1)}%</p>
          </div>
        </div>

        {/* Ligne 3: Statistiques financières */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
          <div className="bg-cyan-50 rounded-lg p-3 text-center border-2 border-cyan-300 shadow-sm">
            <p className="text-xs text-cyan-600 mb-1 font-medium">Valeur Entrées Payées</p>
            <p className="text-xl font-bold text-cyan-800">{allStats.totalValeurEntreesPayees.toFixed(2)} DA</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-3 text-center border-2 border-pink-300 shadow-sm">
            <p className="text-xs text-pink-600 mb-1 font-medium">Moyenne Paiement</p>
            <p className="text-xl font-bold text-pink-800">{allStats.moyennePaiement.toFixed(2)} DA</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 text-center border-2 border-teal-300 shadow-sm">
            <p className="text-xs text-teal-600 mb-1 font-medium">Moyenne Dépense</p>
            <p className="text-xl font-bold text-teal-800">{allStats.moyenneDepense.toFixed(2)} DA</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center border-2 border-indigo-300 shadow-sm">
            <p className="text-xs text-indigo-600 mb-1 font-medium">Solde Global</p>
            <p className={`text-xl font-bold ${allStats.soldeGlobal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {allStats.soldeGlobal.toFixed(2)} DA
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center border-2 border-slate-300 shadow-sm">
            <p className="text-xs text-slate-600 mb-1 font-medium">Prix Moyen Produits</p>
            <p className="text-xl font-bold text-slate-800">{allStats.prixMoyenProduits.toFixed(2)} DA</p>
          </div>
          <div className="bg-rose-50 rounded-lg p-3 text-center border-2 border-rose-300 shadow-sm">
            <p className="text-xs text-rose-600 mb-1 font-medium">Taux Entrées Payées</p>
            <p className="text-xl font-bold text-rose-800">{allStats.tauxEntreesPayees.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Statistiques par Période */}
      {(() => {
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
          moyenne: items.length > 0 ? items.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0) / items.length : 0
        });
        
        const calcDepenses = (items) => ({
          count: items.length,
          total: items.reduce((sum, d) => sum + (d.montant || 0), 0),
          moyenne: items.length > 0 ? items.reduce((sum, d) => sum + (d.montant || 0), 0) / items.length : 0
        });
        
        return (
          <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-2xl p-6 border-4 border-gray-300 shadow-xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="bg-white p-2 rounded-lg shadow-sm text-lg">📅</span>
              <span>Statistiques par Période</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Journalier */}
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 border-3 border-blue-400 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-blue-500 text-white p-2 rounded-lg text-xl">📆</span>
                  <span className="text-xs text-blue-700 font-bold bg-blue-300 px-3 py-1 rounded-full">Aujourd'hui</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Entrées:</span>
                    <span className="text-sm font-bold text-blue-900">{calcEntrees(todayEntrees).count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Paiements:</span>
                    <span className="text-sm font-bold text-blue-900">{calcPaiements(todayPaiements).count} ({calcPaiements(todayPaiements).total.toFixed(2)} DA)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Dépenses:</span>
                    <span className="text-sm font-bold text-blue-900">{calcDepenses(todayDepenses).count} ({calcDepenses(todayDepenses).total.toFixed(2)} DA)</span>
                  </div>
                </div>
              </div>

              {/* Hebdomadaire */}
              <div className="bg-gradient-to-br from-green-100 to-green-200 border-3 border-green-400 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-green-500 text-white p-2 rounded-lg text-xl">📅</span>
                  <span className="text-xs text-green-700 font-bold bg-green-300 px-3 py-1 rounded-full">Cette Semaine</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Entrées:</span>
                    <span className="text-sm font-bold text-green-900">{calcEntrees(weekEntrees).count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Paiements:</span>
                    <span className="text-sm font-bold text-green-900">{calcPaiements(weekPaiements).count} ({calcPaiements(weekPaiements).total.toFixed(2)} DA)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Dépenses:</span>
                    <span className="text-sm font-bold text-green-900">{calcDepenses(weekDepenses).count} ({calcDepenses(weekDepenses).total.toFixed(2)} DA)</span>
                  </div>
                </div>
              </div>

              {/* Mensuel */}
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-3 border-purple-400 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-purple-500 text-white p-2 rounded-lg text-xl">📊</span>
                  <span className="text-xs text-purple-700 font-bold bg-purple-300 px-3 py-1 rounded-full">Ce Mois</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Entrées:</span>
                    <span className="text-sm font-bold text-purple-900">{calcEntrees(monthEntrees).count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Paiements:</span>
                    <span className="text-sm font-bold text-purple-900">{calcPaiements(monthPaiements).count} ({calcPaiements(monthPaiements).total.toFixed(2)} DA)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-700 font-medium">Dépenses:</span>
                    <span className="text-sm font-bold text-purple-900">{calcDepenses(monthDepenses).count} ({calcDepenses(monthDepenses).total.toFixed(2)} DA)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRODUITS */}
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-3 border-blue-300 shadow-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-blue-500 text-white p-2 rounded-lg">📦</span>
          <span>Produits ({allStats.totalProduits})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white/80 rounded-lg p-4 border-2 border-blue-200 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Valeur Totale</p>
            <p className="text-2xl font-bold text-blue-800">{allStats.valeurTotaleProduits.toFixed(2)} DA</p>
          </div>
          <div className="bg-white/80 rounded-lg p-4 border-2 border-blue-200 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Prix Moyen</p>
            <p className="text-2xl font-bold text-blue-800">{allStats.prixMoyenProduits.toFixed(2)} DA</p>
          </div>
          <div className="bg-white/80 rounded-lg p-4 border-2 border-blue-200 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Avec Référence</p>
            <p className="text-2xl font-bold text-blue-800">{allStats.produitsAvecReference}</p>
          </div>
        </div>
        {(state.produits || []).length === 0 ? (
          <div className="bg-white rounded-lg p-4 text-center text-gray-500">
            Aucun produit enregistré
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(state.produits || []).slice(0, 6).map((produit) => (
              <div key={produit.id} className="bg-white rounded-lg border-2 border-blue-200 p-3 shadow-sm">
                <h3 className="font-bold text-gray-900">{produit.nom}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Prix: {produit.prix_achat ?? produit.prixAchat ?? 0} DA
                </p>
                {produit.reference && (
                  <p className="text-xs text-gray-500 mt-1">Réf: {produit.reference}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ENTRÉES RÉCENTES */}
      <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border-3 border-green-300 shadow-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-green-500 text-white p-2 rounded-lg">📥</span>
          <span>Entrées Récentes ({allStats.totalEntrees} total)</span>
        </h2>
        {(state.entrees || []).length === 0 ? (
          <div className="bg-white rounded-lg p-4 text-center text-gray-500">
            Aucune entrée enregistrée
          </div>
        ) : (
          <div className="space-y-3">
            {allStats.entreesRecent.map((entree) => (
              <div key={entree.id} className="bg-white rounded-lg border-2 border-green-200 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">Date: {entree.date}</p>
                    <p className="text-sm text-gray-600">
                      Fournisseur: {getFournisseurName(entree)}
                    </p>
                    {!USE_SUPABASE && entree.lignes && (
                      <p className="text-xs text-gray-500 mt-1">
                        {entree.lignes.length} ligne(s) de produit
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    entree.paye 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {entree.paye ? '✅ Payé' : '⏳ Non Payé'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PAIEMENTS RÉCENTS */}
      <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border-3 border-purple-300 shadow-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-purple-500 text-white p-2 rounded-lg">💳</span>
          <span>Paiements Récents ({allStats.totalPaiements} total)</span>
        </h2>
        {(state.paiements || []).length === 0 ? (
          <div className="bg-white rounded-lg p-4 text-center text-gray-500">
            Aucun paiement enregistré
          </div>
        ) : (
          <div className="space-y-3">
            {allStats.paiementsRecent.map((paiement) => (
              <div key={paiement.id} className="bg-white rounded-lg border-2 border-purple-200 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {parseFloat(paiement.montant || 0).toFixed(2)} DA
                    </p>
                    <p className="text-sm text-gray-600">
                      Fournisseur: {getFournisseurName(paiement.fournisseur_id ?? paiement.fournisseurId)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Date: {paiement.date}</p>
                    {paiement.description && (
                      <p className="text-xs text-gray-400 mt-1">{paiement.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DÉPENSES RÉCENTES */}
      <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl border-3 border-orange-300 shadow-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="bg-orange-500 text-white p-2 rounded-lg">💰</span>
          <span>Dépenses Récentes ({allStats.totalDepenses} total, {allStats.nombreCategories} catégories)</span>
        </h2>
        {(state.depenses || []).length === 0 ? (
          <div className="bg-white rounded-lg p-4 text-center text-gray-500">
            Aucune dépense enregistrée
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {allStats.depensesRecent.map((depense) => (
                <div key={depense.id} className="bg-white rounded-lg border-2 border-orange-200 p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {depense.montant.toFixed(2)} DA
                      </p>
                      {(depense.nom || depense.depense_categories?.nom) && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full mt-1 inline-block">
                          {depense.depense_categories?.nom || depense.nom}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Date: {depense.date}</p>
                      {depense.description && (
                        <p className="text-xs text-gray-400 mt-1">{depense.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(allStats.depensesParCategorie).length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-orange-300">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par Catégorie</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(allStats.depensesParCategorie).map(([nom, data]) => (
                    <div key={nom} className="bg-white rounded-lg border border-orange-200 p-2 text-center">
                      <p className="text-xs text-gray-600 font-medium">{nom}</p>
                      <p className="text-sm font-bold text-orange-800">{data.total.toFixed(2)} DA</p>
                      <p className="text-xs text-gray-500">{data.count} fois</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
