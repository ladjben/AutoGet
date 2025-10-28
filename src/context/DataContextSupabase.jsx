import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../config/supabase'

const DataContext = createContext()

export const DataProvider = ({ children }) => {
  const [produits, setProduits] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [entrees, setEntrees] = useState([])
  const [depenses, setDepenses] = useState([])
  const [paiements, setPaiements] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Charger toutes les données au démarrage
  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setIsLoading(true)
    await Promise.all([
      fetchProduits(), 
      fetchFournisseurs(), 
      fetchEntrees(), 
      fetchDepenses(),
      fetchPaiements()
    ])
    setIsLoading(false)
  }

  async function fetchProduits() {
    const { data, error } = await supabase
      .from('produits')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setProduits(data || [])
  }

  async function fetchFournisseurs() {
    const { data, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setFournisseurs(data || [])
  }

  async function fetchEntrees() {
    const { data, error } = await supabase
      .from('entrees')
      .select('*')
      .order('date', { ascending: false })
    if (!error) setEntrees(data || [])
  }

  async function fetchDepenses() {
    const { data, error } = await supabase
      .from('depenses')
      .select('*')
      .order('date', { ascending: false })
    if (!error) setDepenses(data || [])
  }

  async function fetchPaiements() {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .order('date', { ascending: false })
    if (!error) setPaiements(data || [])
  }

  // Ajouter un nouveau produit
  async function addProduit(nom, reference, prix_achat) {
    const { error } = await supabase
      .from('produits')
      .insert([{ nom, reference, prix_achat }])
    if (!error) await fetchProduits()
    return { error }
  }

  // Ajouter un fournisseur
  async function addFournisseur(nom, contact, adresse) {
    const { error } = await supabase
      .from('fournisseurs')
      .insert([{ nom, contact, adresse }])
    if (!error) await fetchFournisseurs()
    return { error }
  }

  // Ajouter une dépense
  async function addDepense(montant, description, date) {
    const { error } = await supabase
      .from('depenses')
      .insert([{ montant, description, date }])
    if (!error) await fetchDepenses()
    return { error }
  }

  // Ajouter une entrée de marchandise
  async function addEntree(date, fournisseur_id) {
    const { error } = await supabase
      .from('entrees')
      .insert([{ date, fournisseur_id }])
    if (!error) await fetchEntrees()
    return { error }
  }

  // Ajouter un paiement
  async function addPaiement(fournisseur_id, montant, date, description) {
    const { error } = await supabase
      .from('paiements')
      .insert([{ fournisseur_id, montant, date, description }])
    if (!error) await fetchPaiements()
    return { error }
  }

  // Helper pour générer des IDs
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Format state pour compatibilité avec l'interface existante
  const state = {
    produits,
    fournisseurs,
    entrees,
    depenses,
    paiements,
    isLoading
  }

  return (
    <DataContext.Provider
      value={{
        state,
        produits,
        fournisseurs,
        entrees,
        depenses,
        paiements,
        isLoading,
        addProduit,
        addFournisseur,
        addDepense,
        addEntree,
        addPaiement,
        fetchAll,
        generateId,
        dispatch: () => {}, // Compatibilité
        supabase
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
