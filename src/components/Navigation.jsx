import cosmosLogo from '../assets/cosmos-logo.svg';

const Navigation = ({ activeView, setActiveView, user, logout, isAdmin, isUser }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: '📊' },
    { id: 'products', label: 'Produits', icon: '👟' },
    { id: 'entries', label: 'Entrées de Stock', icon: '📥' },
    { id: 'suppliers', label: 'Fournisseurs', icon: '🏢' },
    { id: 'depenses', label: 'Dépenses', icon: '💰' },
    { id: 'colis', label: 'Colis Envoyés', icon: '📦' },
  ];

  return (
    <nav className="bg-white shadow-lg border-b-2 border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex flex-1 items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <img 
                src={cosmosLogo} 
                alt="Cosmos Algérie" 
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  COSMOS ALGÉRIE
                </h1>
                <p className="text-xs text-gray-500 font-medium">Gestion & Suivi</p>
              </div>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-6 items-center">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeView === item.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2 text-base">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* User info and logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 rounded-lg border-2 border-gray-200">
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{user?.name}</div>
                <div className={`text-xs font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                  {isAdmin() ? '🔴 Administrateur' : '🔵 Utilisateur'}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          <div className="px-4 py-3 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <img 
                src={cosmosLogo} 
                alt="Cosmos Algérie" 
                className="h-8 w-auto"
              />
              <div>
                <div className="text-sm font-bold text-gray-900">{user?.name}</div>
                <div className={`text-xs font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                  {isAdmin() ? '🔴 Administrateur' : '🔵 Utilisateur'}
                </div>
              </div>
            </div>
            <div className="text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              COSMOS ALGÉRIE
            </div>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full text-left block pl-4 pr-4 py-3 border-l-4 text-base font-bold rounded-r-lg transition-all ${
                activeView === item.id
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
