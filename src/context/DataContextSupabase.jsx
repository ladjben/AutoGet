// --- AJOUTER DANS DataContextSupabase.jsx (garde le reste) ---
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../config/supabaseClient'

const DataContext = createContext()

export const DataProvider = ({ children }) => {
  const [produits, setProduits] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [entrees, setEntrees] = useState([])
  const [depenses, setDepenses] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    await Promise.all([fetchProduits(), fetchFournisseurs(), fetchEntrees(), fetchDepenses()])
  }

  async function fetchProduits() {
    const { data, error } = await supabase.from('produits').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    else setProduits(data || [])
  }

  async function fetchFournisseurs() {
    const { data, error } = await supabase.from('fournisseurs').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    else setFournisseurs(data || [])
  }

  async function fetchEntrees() {
    const { data, error } = await supabase
      .from('entrees')
      .select('id, date, paye, fournisseur_id')
      .order('date', { ascending: false })
    if (error) console.error(error)
    else setEntrees(data || [])
  }

  async function fetchDepenses() {
    const { data, error } = await supabase.from('depenses').select('*').order('date', { ascending: false })
    if (error) console.error(error)
    else setDepenses(data || [])
  }

  // === Petits create simples (déjà utiles ailleurs) ===
  async function addProduit(nom, reference, prix_achat) {
    const { error } = await supabase.from('produits').insert([{ nom, reference, prix_achat }])
    if (error) return console.error(error)
    fetchProduits()
  }
  async function addFournisseur(nom, contact, adresse) {
    const { error } = await supabase.from('fournisseurs').insert([{ nom, contact, adresse }])
    if (error) return console.error(error)
    fetchFournisseurs()
  }
  async function addDepense(nom, montant, description, date) {
    const { error } = await supabase.from('depenses').insert([{ nom, montant, description: description || '', date }])
    if (error) return console.error(error)
    fetchDepenses()
  }

  // Mise à jour dépense
  async function updateDepense(id, { nom, montant, description, date }) {
    try {
      const { error } = await supabase
        .from('depenses')
        .update({ nom, montant, description: description || '', date })
        .eq('id', id)
      if (error) throw error
      await fetchDepenses()
      return { success: true }
    } catch (e) {
      console.error('updateDepense:', e)
      throw e
    }
  }

  // Suppression dépense
  async function deleteDepense(id) {
    try {
      console.log('🗑️ Suppression dépense:', id)
      const { error } = await supabase
        .from('depenses')
        .delete()
        .eq('id', id)
      if (error) throw error
      console.log('✅ Dépense supprimée:', id)
      await fetchDepenses()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deleteDepense:', e?.message || e)
      throw e
    }
  }

  // Mise à jour produit
  async function updateProduit(id, { nom, reference, prix_achat }) {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ nom, reference, prix_achat })
        .eq('id', id)
      if (error) throw error
      await fetchProduits()
      return { success: true }
    } catch (e) {
      console.error('updateProduit:', e)
      return { success: false, error: e?.message }
    }
  }

  // Suppression produit
  async function deleteProduit(id) {
    try {
      console.log('🗑️ Suppression produit:', id)
      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', id)
      if (error) throw error
      console.log('✅ Produit supprimé:', id)
      await fetchProduits()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deleteProduit:', e?.message || e)
      throw e
    }
  }

  // === NOUVEAU : lire les lignes d’une entrée ===
  async function fetchEntreeDetails(entreeId) {
    const { data, error } = await supabase
      .from('entree_lignes')
      .select(`
        id, quantite, created_at,
        produit_id ( id, nom, reference, prix_achat ),
        variante_id ( id, taille, couleur, modele, quantite )
      `)
      .eq('entree_id', entreeId)
    if (error) {
      console.error('fetchEntreeDetails:', error)
      return []
    }
    return data || []
  }

  // === NOUVEAU : créer une entrée + TOUTES ses lignes ===
  /**
   * payload = {
   *   date: '2025-10-28',
   *   fournisseur_id: 'uuid-fournisseur',
   *   paye: false,
   *   lignes: [
   *     { produit_id: 'uuid_produit' , quantite: 5 },
   *     { variante_id: 'uuid_variante', quantite: 8 }
   *   ]
   * }
   */
  async function addEntreeWithLines(payload) {
    const { date, fournisseur_id, paye = false, lignes = [] } = payload || {}

    if (!date || !fournisseur_id) throw new Error('date et fournisseur_id sont obligatoires')
    if (!Array.isArray(lignes) || lignes.length === 0) throw new Error('ajoute au moins une ligne')

    for (const l of lignes) {
      if (!l.quantite || l.quantite <= 0) throw new Error('quantite > 0 requise')
      if (!l.produit_id && !l.variante_id) throw new Error('produit_id OU variante_id requis')
    }

    // 1) créer l'entrée
    const { data: entreeRow, error: e1 } = await supabase
      .from('entrees')
      .insert([{ date, fournisseur_id, paye }])
      .select('id')
      .single()
    if (e1) throw e1
    const entree_id = entreeRow.id

    // 2) insérer toutes les lignes
    const rows = lignes.map(l => ({
      entree_id,
      produit_id: l.produit_id || null,
      variante_id: l.variante_id || null,
      quantite: l.quantite,
    }))
    const { error: e2 } = await supabase.from('entree_lignes').insert(rows)
    if (e2) throw e2

    // 3) (optionnel) maj stock variantes si tu utilises variantes.quantite
    const onlyVar = lignes.filter(l => l.variante_id)
    for (const v of onlyVar) {
      const { data: row, error: e3 } = await supabase
        .from('variantes')
        .select('id, quantite')
        .eq('id', v.variante_id)
        .single()
      if (e3) { console.error(e3); continue }
      const { error: e4 } = await supabase
        .from('variantes')
        .update({ quantite: (row?.quantite || 0) + v.quantite })
        .eq('id', v.variante_id)
      if (e4) console.error(e4)
    }

    // 4) refresh
    await fetchEntrees()
    return { entree_id, lignes_count: rows.length }
  }

  return (
    <DataContext.Provider
      value={{
        // states
        produits, fournisseurs, entrees, depenses,
        // reads
        fetchAll, fetchProduits, fetchFournisseurs, fetchEntrees, fetchDepenses, fetchEntreeDetails,
        // writes
        addProduit, updateProduit, deleteProduit, addFournisseur, addDepense, updateDepense, deleteDepense,
        addEntreeWithLines, // ⬅️ NOUVEAU
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
