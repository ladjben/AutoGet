const Navigation = ({ activeView, setActiveView, user, logout, isAdmin, isUser }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: '📊' },
    { id: 'products', label: 'Produits', icon: '👟' },
    { id: 'entries', label: 'Entrées de Stock', icon: '📥' },
    { id: 'suppliers', label: 'Fournisseurs', icon: '🏢' },
    { id: 'depenses', label: 'Dépenses', icon: '💰' },
    { id: 'colis', label: 'Colis Envoyés', icon: '📦' },
    { id: 'salaries', label: 'Salariés', icon: '👥' },
  ];

  // Debug: Vérifier que navItems contient bien salaries
  if (typeof window !== 'undefined' && !navItems.find(item => item.id === 'salaries')) {
    console.error('❌ Salariés manquant dans navItems!', navItems);
  }

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="w-full px-2 sm:px-4">
        <div className="flex justify-between items-center h-14 gap-2">
          {/* Logo et titre - Réduit */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">
              COSMOS ALGÉRIE
            </h1>
            <span className="ml-1 text-[10px] sm:text-xs text-gray-500 font-medium hidden lg:inline whitespace-nowrap">Gestion & Suivi</span>
          </div>

          {/* Navigation items - Utilise tout l'espace disponible avec scroll */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto scrollbar-hide min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-max">
              {navItems.map((item) => {
                // Debug pour Salariés
                if (item.id === 'salaries') {
                  console.log('✅ Salariés trouvé dans navItems:', item);
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      console.log('Navigation vers:', item.id, item.label);
                      setActiveView(item.id);
                    }}
                    className={`inline-flex items-center px-2 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      activeView === item.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-1 text-xs sm:text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User info and logout - Compact */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="hidden md:flex flex-col items-end mr-1 min-w-0">
              <div className="text-[10px] sm:text-xs font-medium text-gray-900 truncate max-w-[100px]">{user?.name}</div>
              <div className={`text-[9px] sm:text-[10px] font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                {isAdmin() ? '🔴 Admin' : '🔵 User'}
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="md:hidden border-t border-gray-200">
        <div className="px-2 py-2 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{user?.name}</div>
              <div className={`text-[10px] font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                {isAdmin() ? '🔴 Admin' : '🔵 User'}
              </div>
            </div>
          </div>
        </div>
        <div className="px-1 pb-2 overflow-x-auto flex gap-1 scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex-shrink-0 inline-flex items-center px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                activeView === item.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-1 text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
