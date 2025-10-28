import { useEffect, useState } from 'react'
import { supabase } from './config/supabaseClient'
import { USE_SUPABASE } from './config'

import { DataProvider as DataProviderLocal } from './context/DataContext'
import { DataProvider as DataProviderSupabase } from './context/DataContextSupabase'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login from './components/Login'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Entries from './components/Entries'
import Suppliers from './components/Suppliers'
import Depenses from './components/Depenses'

// Sélection du provider selon la configuration
const DataProvider = USE_SUPABASE ? DataProviderSupabase : DataProviderLocal

// Petit composant bandeau pour afficher l’état de la connexion Supabase
function SupabaseHealthBar() {
  const [status, setStatus] = useState({ ok: true, msg: '' })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (!USE_SUPABASE) {
        // Pas de Supabase => rien à tester
        return
      }
      try {
        const { data, error } = await supabase.from('produits').select('id').limit(1)
        if (error) throw error
        if (!cancelled) setStatus({ ok: true, msg: `Connexion OK — produitsCount: ${data?.length ?? 0}` })
      } catch (e) {
        if (!cancelled) setStatus({ ok: false, msg: e?.message || 'Erreur inconnue' })
        // Log console utile en debug
        // eslint-disable-next-line no-console
        console.error('Supabase error:', e)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  if (!USE_SUPABASE) return null

  return (
    <div
      className={`w-full px-4 py-2 text-sm ${
        status.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {status.ok ? '✅ ' : '❌ '}Supabase: {status.msg}
    </div>
  )
}

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
      default:
        return <Dashboard />
    }
  }

  // Si pas authentifié, afficher la page de login
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SupabaseHealthBar />
        <main className="p-6">
          <Login />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SupabaseHealthBar />
      <Navigation
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        logout={logout}
        isAdmin={isAdmin}
        isUser={isUser}
      />
      <main className="p-6">{renderView()}</main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  )
}

export default App
