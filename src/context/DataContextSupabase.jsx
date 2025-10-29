// --- AJOUTER DANS DataContextSupabase.jsx (garde le reste) ---
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../config/supabaseClient'

const DataContext = createContext()

export const DataProvider = ({ children }) => {
  const [produits, setProduits] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [entrees, setEntrees] = useState([])
  const [paiements, setPaiements] = useState([])
  const [depenses, setDepenses] = useState([])
  const [depenseCategories, setDepenseCategories] = useState([])
  const [colis, setColis] = useState([])
  const [salaries, setSalaries] = useState([])
  const [acomptes, setAcomptes] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    await Promise.all([
      fetchProduits(), 
      fetchFournisseurs(), 
      fetchEntrees(),
      fetchPaiements(),
      fetchDepenses(),
      fetchDepenseCategories(),
      fetchColis(),
      fetchSalaries(),
      fetchAcomptes()
    ])
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

  async function fetchPaiements() {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .order('date', { ascending: false })
    if (error) console.error(error)
    else setPaiements(data || [])
  }

  async function fetchDepenses() {
    const { data, error } = await supabase
      .from('depenses')
      .select('*, depense_categories(id, nom)')
      .order('date', { ascending: false })
    if (error) console.error(error)
    else setDepenses(data || [])
  }

  // === Gestion des catégories de dépenses ===
  async function fetchDepenseCategories() {
    const { data, error } = await supabase
      .from('depense_categories')
      .select('*')
      .order('nom', { ascending: true })
    if (error) console.error(error)
    else setDepenseCategories(data || [])
  }

  async function addDepenseCategory(nom) {
    try {
      const { data, error } = await supabase
        .from('depense_categories')
        .insert([{ nom }])
        .select()
        .single()
      if (error) throw error
      await fetchDepenseCategories()
      return { success: true, data }
    } catch (e) {
      console.error('addDepenseCategory:', e)
      throw e
    }
  }

  async function deleteDepenseCategory(id) {
    try {
      // Vérifier si la catégorie est utilisée
      const { count } = await supabase
        .from('depenses')
        .select('id', { count: 'exact', head: true })
        .eq('categorie_id', id)
      
      if (count > 0) {
        throw new Error(`Cette catégorie est utilisée par ${count} dépense(s). Suppression impossible.`)
      }

      const { error } = await supabase
        .from('depense_categories')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await fetchDepenseCategories()
      return { success: true }
    } catch (e) {
      console.error('deleteDepenseCategory:', e)
      throw e
    }
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

  // === Gestion des paiements ===
  async function addPaiement(fournisseur_id, montant, date, description) {
    try {
      console.log('💰 Ajout paiement:', { fournisseur_id, montant, date, description })
      
      // S'assurer que la date est au format YYYY-MM-DD
      const dateFormatted = date ? date.split('T')[0] : new Date().toISOString().split('T')[0]
      
      const { error } = await supabase
        .from('paiements')
        .insert([{
          fournisseur_id,
          montant: parseFloat(montant),
          date: dateFormatted,
          description: description || ''
        }])
      
      if (error) throw error
      
      console.log('✅ Paiement ajouté avec succès')
      
      // Rafraîchir les paiements et les entrées (pour recalculer les soldes)
      await Promise.all([
        fetchPaiements(),
        fetchEntrees()
      ])
      
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur addPaiement:', e?.message || e)
      throw e
    }
  }

  async function deletePaiement(id) {
    try {
      console.log('🗑️ Suppression paiement:', id)
      const { error } = await supabase
        .from('paiements')
        .delete()
        .eq('id', id)
      if (error) throw error
      console.log('✅ Paiement supprimé:', id)
      
      // Rafraîchir les paiements et les entrées
      await Promise.all([
        fetchPaiements(),
        fetchEntrees()
      ])
      
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deletePaiement:', e?.message || e)
      throw e
    }
  }
  async function addDepense(nom, montant, description, date) {
    try {
      // Le trigger SQL va créer/rattacher automatiquement la catégorie si nécessaire
      const { error } = await supabase
        .from('depenses')
        .insert([{ nom, montant, description: description || '', date }])
      if (error) throw error
      await fetchDepenses()
      await fetchDepenseCategories() // Rafraîchir les catégories au cas où une nouvelle a été créée
      return { success: true }
    } catch (e) {
      console.error('addDepense:', e)
      throw e
    }
  }

  // Mise à jour dépense
  async function updateDepense(id, { nom, montant, description, date }) {
    try {
      // Le trigger SQL va créer/rattacher automatiquement la catégorie si nécessaire
      const { error } = await supabase
        .from('depenses')
        .update({ nom, montant, description: description || '', date })
        .eq('id', id)
      if (error) throw error
      await fetchDepenses()
      await fetchDepenseCategories() // Rafraîchir les catégories au cas où une nouvelle a été créée
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

  // ========== COLIS ==========
  async function fetchColis() {
    try {
      const { data, error } = await supabase
        .from('colis')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      setColis(data || [])
    } catch (e) {
      console.error('❌ Erreur fetchColis:', e?.message || e)
    }
  }

  async function addColis(nombre, date, description) {
    try {
      const { error } = await supabase
        .from('colis')
        .insert([{ nombre, date, description: description || '' }])
      if (error) throw error
      await fetchColis()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur addColis:', e?.message || e)
      throw e
    }
  }

  async function updateColis(id, { nombre, date, description }) {
    try {
      const { error } = await supabase
        .from('colis')
        .update({ nombre, date, description: description || '' })
        .eq('id', id)
      if (error) throw error
      await fetchColis()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur updateColis:', e?.message || e)
      throw e
    }
  }

  async function deleteColis(id) {
    try {
      const { error } = await supabase
        .from('colis')
        .delete()
        .eq('id', id)
      if (error) throw error
      await fetchColis()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deleteColis:', e?.message || e)
      throw e
    }
  }

  // ========== SALARIES ==========
  async function fetchSalaries() {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSalaries(data || [])
    } catch (e) {
      console.error('❌ Erreur fetchSalaries:', e?.message || e)
    }
  }

  async function addSalary(nom, salaire_mensuel, contact, poste) {
    try {
      const { error } = await supabase
        .from('salaries')
        .insert([{ nom, salaire_mensuel: parseFloat(salaire_mensuel), contact: contact || '', poste: poste || '' }])
      if (error) throw error
      await fetchSalaries()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur addSalary:', e?.message || e)
      throw e
    }
  }

  async function updateSalary(id, { nom, salaire_mensuel, contact, poste }) {
    try {
      const { error } = await supabase
        .from('salaries')
        .update({ nom, salaire_mensuel: parseFloat(salaire_mensuel), contact: contact || '', poste: poste || '' })
        .eq('id', id)
      if (error) throw error
      await fetchSalaries()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur updateSalary:', e?.message || e)
      throw e
    }
  }

  async function deleteSalary(id) {
    try {
      const { error } = await supabase
        .from('salaries')
        .delete()
        .eq('id', id)
      if (error) throw error
      await fetchSalaries()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deleteSalary:', e?.message || e)
      throw e
    }
  }

  // ========== ACOMPTES ==========
  async function fetchAcomptes() {
    try {
      const { data, error } = await supabase
        .from('acomptes')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      setAcomptes(data || [])
    } catch (e) {
      console.error('❌ Erreur fetchAcomptes:', e?.message || e)
    }
  }

  async function addAcompte(salary_id, montant, date, description) {
    try {
      const dateFormatted = date ? date.split('T')[0] : new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .from('acomptes')
        .insert([{
          salary_id,
          montant: parseFloat(montant),
          date: dateFormatted,
          description: description || ''
        }])
      if (error) throw error
      await fetchAcomptes()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur addAcompte:', e?.message || e)
      throw e
    }
  }

  async function deleteAcompte(id) {
    try {
      const { error } = await supabase
        .from('acomptes')
        .delete()
        .eq('id', id)
      if (error) throw error
      await fetchAcomptes()
      return { success: true }
    } catch (e) {
      console.error('❌ Erreur deleteAcompte:', e?.message || e)
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
        produits, fournisseurs, entrees, paiements, depenses, depenseCategories, colis, salaries, acomptes,
        // reads
        fetchAll, fetchProduits, fetchFournisseurs, fetchEntrees, fetchPaiements, fetchDepenses, fetchDepenseCategories, fetchEntreeDetails, fetchColis, fetchSalaries, fetchAcomptes,
        // writes
        addProduit, updateProduit, deleteProduit, addFournisseur,
        addPaiement, deletePaiement,
        addDepense, updateDepense, deleteDepense,
        addDepenseCategory, deleteDepenseCategory,
        addEntreeWithLines,
        addColis, updateColis, deleteColis,
        addSalary, updateSalary, deleteSalary,
        addAcompte, deleteAcompte,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
