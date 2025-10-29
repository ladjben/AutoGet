const Navigation = ({ activeView, setActiveView, user, logout, isAdmin, isUser }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: '📊' },
    { id: 'products', label: 'Produits', icon: '👟' },
    { id: 'entries', label: 'Entrées', icon: '📥' },
    { id: 'suppliers', label: 'Fournisseurs', icon: '🏢' },
    { id: 'depenses', label: 'Dépenses', icon: '💰' },
    { id: 'colis', label: 'Colis', icon: '📦' },
    { id: 'salaries', label: 'Salariés', icon: '👥' },
  ];

  // Debug
  console.log('🔍 Navigation - navItems:', navItems.length, navItems.map(i => i.label));

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="w-full">
        <div className="flex items-center justify-between h-14 px-1 gap-1">
          {/* Logo - Très compact */}
          <div className="flex-shrink-0 px-1">
            <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">
              COSMOS ALGÉRIE
            </h1>
          </div>

          {/* Navigation - Tous les items visibles avec scroll si nécessaire */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-0.5 min-w-max">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      console.log('🧭 Navigation vers:', item.id, item.label);
                      setActiveView(item.id);
                    }}
                    className={`inline-flex items-center px-1.5 py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-0.5 text-xs">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User & Logout - Très compact */}
          <div className="flex items-center gap-1 flex-shrink-0 px-1">
            <div className="hidden sm:flex flex-col items-end text-[9px] sm:text-[10px]">
              <div className="font-medium text-gray-900 truncate max-w-[80px]">{user?.name}</div>
              <div className={`font-semibold ${isAdmin() ? 'text-red-600' : 'text-blue-600'}`}>
                {isAdmin() ? 'Admin' : 'User'}
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu - Tous les items visibles */}
      <div className="md:hidden border-t border-gray-200">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 px-1 py-2">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="mr-1 text-xs">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
