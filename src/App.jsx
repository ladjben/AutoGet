import { USE_SUPABASE } from './config';
import { DataProvider as DataProviderLocal } from './context/DataContext';
import { DataProvider as DataProviderSupabase } from './context/DataContextSupabase';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Entries from './components/Entries';
import Suppliers from './components/Suppliers';
import { useState } from 'react';

// Sélection du provider selon la configuration
const DataProvider = USE_SUPABASE ? DataProviderSupabase : DataProviderLocal;

function App() {
  const [activeView, setActiveView] = useState('dashboard');

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

  return (
    <DataProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation activeView={activeView} setActiveView={setActiveView} />
        <main className="p-6">
          {renderView()}
        </main>
      </div>
    </DataProvider>
  );
}

export default App;
