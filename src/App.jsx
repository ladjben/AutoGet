import { USE_SUPABASE } from './config';
import { DataProvider as DataProviderLocal } from './context/DataContext';
import { DataProvider as DataProviderSupabase } from './context/DataContextSupabase';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Entries from './components/Entries';
import Suppliers from './components/Suppliers';
import { useState } from 'react';

// Sélection du provider selon la configuration
const DataProvider = USE_SUPABASE ? DataProviderSupabase : DataProviderLocal;

const AppContent = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const { user, logout, isAdmin, isUser } = useAuth();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'entries':
        return <Entries />;
      case 'suppliers':
        return <Suppliers />;
      default:
        return <Dashboard />;
    }
  };

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        activeView={activeView} 
        setActiveView={setActiveView} 
        user={user}
        logout={logout}
        isAdmin={isAdmin}
        isUser={isUser}
      />
      <main className="p-6">
        {renderView()}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
