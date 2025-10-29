import React, { useState } from 'react'

// Provider unifié (local ou Supabase selon ta config)
import { DataProvider } from './context/UnifiedDataContext'

// Auth
import { AuthProvider, useAuth } from './context/AuthContext'

// UI / Pages
import Login from './components/Login'
import AppHeader from './components/AppHeader'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Entries from './components/Entries'
import Suppliers from './components/Suppliers'
import Depenses from './components/Depenses'
import Colis from './components/Colis'
import Salaries from './components/Salaries'

/**
 * Garde ce composant simple : AppHeader reçoit
 * - la nouvelle API (onNavigate, role, produitsCount, supabaseStatus, onLogout, brand)
 * - ET les anciennes props (setActiveView, isAdmin, isUser, logout) pour compatibilité.
 */
const AppContent = () => {
  const [activeView, setActiveView] = useState('dashboard')
  const { user, logout, isAdmin, isUser } = useAuth()

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
      default:
        return <Dashboard />
    }
  }

  // Non connecté → page Login
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="p-6">
          <Login />
        </main>
      </div>
    )
  }

  // Compteurs / Status (met un vrai produitsCount si tu as un state global)
  const produitsCount = 0
  const supabaseStatus = 'Connexion OK'

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        /* ====== API moderne (shadcn) ====== */
        brand={{ title: 'COSMOS ALGÉRIE', subtitle: 'Gestion & Suivi' }}
        activeView={activeView}
        onNavigate={setActiveView}
        user={user}
        role={isAdmin?.() ? 'Administrateur' : 'Utilisateur'}
        produitsCount={produitsCount}
        supabaseStatus={supabaseStatus}
        onLogout={logout}
        /* ====== Compat héritée (ancien header) ====== */
        setActiveView={setActiveView}
        isAdmin={isAdmin}
        isUser={isUser}
        logout={logout}
      />

      <main className="p-6">
        {renderView()}
      </main>
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
