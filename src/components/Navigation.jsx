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
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et titre */}
          <div className="flex items-center flex-shrink-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              COSMOS ALGÉRIE
            </h1>
            <span className="ml-2 text-xs text-gray-500 font-medium hidden sm:inline">Gestion & Suivi</span>
          </div>

          {/* Navigation items - Centré */}
          <div className="flex-1 flex justify-center">
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeView === item.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User info and logout - Droite */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <div className="text-sm font-medium text-gray-900">{user?.name}</div>
              <div className={`text-xs font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                {isAdmin() ? '🔴 Administrateur' : '🔵 Utilisateur'}
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="md:hidden border-t border-gray-200">
        <div className="px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{user?.name}</div>
              <div className={`text-xs font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                {isAdmin() ? '🔴 Administrateur' : '🔵 Utilisateur'}
              </div>
            </div>
          </div>
        </div>
        <div className="px-2 pb-2 overflow-x-auto flex space-x-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex-shrink-0 inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === item.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-1">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
