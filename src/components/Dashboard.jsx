import { useData, ActionTypes } from '../context/DataContext';

const Dashboard = () => {
  const { state } = useData();

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `gestion-chaussures-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalStockValue = 0;
    let totalDue = 0;
    let totalEntries = 0;
    let totalPaid = 0;

    // Calculate amounts due and paid
    state.entrees.forEach(entree => {
      let entreeValue = 0;
      
      entree.lignes?.forEach(ligne => {
        const produit = state.produits.find(p => p.id === ligne.produitId);
        if (produit) {
          entreeValue += ligne.quantite * produit.prixAchat;
        }
      });

      totalEntries++;
      
      if (entree.paye) {
        totalPaid += entreeValue;
      } else {
        totalDue += entreeValue;
      }
    });

    return { totalStockValue, totalDue, totalPaid, totalEntries };
  };

  const { totalStockValue, totalDue, totalPaid, totalEntries } = calculateTotals();

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = state.fournisseurs.find(f => f.id === fournisseurId);
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
        <button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          📥 Exporter les Données
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📦</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Valeur Stock Total
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {totalStockValue.toFixed(2)} DA
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">💰</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Dû aux Fournisseurs
                  </dt>
                  <dd className="text-lg font-semibold text-red-600">
                    {totalDue.toFixed(2)} DA
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">✅</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Payé
                  </dt>
                  <dd className="text-lg font-semibold text-green-600">
                    {totalPaid.toFixed(2)} DA
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📊</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Entrées
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {totalEntries}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Overview */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Aperçu des Produits</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {state.produits.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucun produit enregistré
            </div>
          ) : (
            state.produits.map((produit) => (
              <div key={produit.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{produit.nom}</h3>
                    <p className="text-sm text-gray-500">
                      Prix d'achat: {produit.prixAchat} DA
                      {produit.reference && ` | Référence: ${produit.reference}`}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Entries */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Historique des Entrées</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {state.entrees.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune entrée enregistrée
            </div>
          ) : (
            state.entrees.slice(-10).reverse().map((entree) => (
              <div key={entree.id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Date: {entree.date}
                    </p>
                    <p className="text-sm text-gray-500">
                      Fournisseur: {getFournisseurName(entree.fournisseurId)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Lignes: {entree.lignes?.length || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      entree.paye 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entree.paye ? 'Payé' : 'Non Payé'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

