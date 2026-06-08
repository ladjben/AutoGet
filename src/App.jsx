import React, { useState, useEffect } from 'react'

// Provider unifié (local ou Supabase selon ta config)
import { DataProvider } from './context/UnifiedDataContext'

// Auth
import { AuthProvider, useAuth } from './context/AuthContext'

// UI / Pages
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import TopHeader from './components/TopHeader'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Entries from './components/Entries'
import Suppliers from './components/Suppliers'
import Depenses from './components/Depenses'
import Colis from './components/Colis'
import Salaries from './components/Salaries'
import SupplierPortal from './components/SupplierPortal'
import EmployeeValidation from './components/EmployeeValidation'
import SupplierAccess from './components/SupplierAccess'

/**
 * Garde ce composant simple : AppHeader reçoit
 * - la nouvelle API (onNavigate, role, produitsCount, supabaseStatus, onLogout, brand)
 * - ET les anciennes props (setActiveView, isAdmin, isUser, logout) pour compatibilité.
 */
const AppContent = () => {
  const [activeView, setActiveView] = useState('dashboard')
  const { user, logout, isAdmin, isUser, isFournisseur, isEmploye } = useAuth()
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tous les hooks doivent être appelés avant tout return conditionnel
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return
    if (isFournisseur()) {
      setActiveView('supplier-portal')
    } else if (isEmploye()) {
      setActiveView('employee-validation')
    } else {
      setActiveView('dashboard')
    }
  }, [user, isFournisseur, isEmploye]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />
      case 'products':
        return <Products />
      case 'entries':
        return <Entries />
      case 'suppliers':
        return <Suppliers />
      case 'depenses':
        return <Depenses />
      case 'colis':
        return <Colis />
      case 'salaries':
        return <Salaries />
      case 'supplier-portal':
        return <SupplierPortal />
      case 'employee-validation':
        return <EmployeeValidation />
      case 'supplier-access':
        return <SupplierAccess />
      default:
        return <Dashboard />
    }
  }

  // Non connecté → page Login
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-6">
          <Login />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        logout={logout}
        isAdmin={isAdmin}
        isUser={isUser}
        isFournisseur={isFournisseur}
        isEmploye={isEmploye}
        isMobile={isMobile}
        sheetOpen={sidebarOpen}
        setSheetOpen={setSidebarOpen}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopHeader
          user={user}
          isAdmin={isAdmin?.()}
          isMobile={isMobile}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {renderView()}
        </main>
      </div>
    </div>
  )
}

/** Garde une boundary simple pour éviter un écran blanc silencieux */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI Error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 text-red-700 p-6">
          <h1 className="text-xl font-bold mb-2">Une erreur est survenue</h1>
          <pre className="whitespace-pre-wrap text-sm">{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </DataProvider>
    </AuthProvider>
  )
}

export default App
