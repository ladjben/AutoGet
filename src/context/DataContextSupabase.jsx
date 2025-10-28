import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

// Initial state
const initialState = {
  produits: [],
  fournisseurs: [],
  entrees: [],
  paiements: [],
  depenses: [],
  isLoading: true
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  LOAD_PRODUITS: 'LOAD_PRODUITS',
  LOAD_FOURNISSEURS: 'LOAD_FOURNISSEURS',
  LOAD_ENTREES: 'LOAD_ENTREES',
  LOAD_PAIEMENTS: 'LOAD_PAIEMENTS',
  LOAD_DEPENSES: 'LOAD_DEPENSES',
  
  // Products
  ADD_PRODUIT: 'ADD_PRODUIT',
  UPDATE_PRODUIT: 'UPDATE_PRODUIT',
  DELETE_PRODUIT: 'DELETE_PRODUIT',
  ADD_VARIANTE: 'ADD_VARIANTE',
  UPDATE_VARIANTE: 'UPDATE_VARIANTE',
  DELETE_VARIANTE: 'DELETE_VARIANTE',
  
  // Suppliers
  ADD_FOURNISSEUR: 'ADD_FOURNISSEUR',
  UPDATE_FOURNISSEUR: 'UPDATE_FOURNISSEUR',
  DELETE_FOURNISSEUR: 'DELETE_FOURNISSEUR',
  
  // Entries
  ADD_ENTREE: 'ADD_ENTREE',
  UPDATE_ENTREE: 'UPDATE_ENTREE',
  DELETE_ENTREE: 'DELETE_ENTREE',
  MARK_ENTREE_PAYEE: 'MARK_ENTREE_PAYEE',
  
  // Payments
  ADD_PAIEMENT: 'ADD_PAIEMENT',
  DELETE_PAIEMENT: 'DELETE_PAIEMENT',
  
  // Depenses
  ADD_DEPENSE: 'ADD_DEPENSE',
  UPDATE_DEPENSE: 'UPDATE_DEPENSE',
  DELETE_DEPENSE: 'DELETE_DEPENSE',
};

// Reducer
const dataReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };
      
    case ActionTypes.LOAD_PRODUITS:
      return { ...state, produits: action.payload };
      
    case ActionTypes.LOAD_FOURNISSEURS:
      return { ...state, fournisseurs: action.payload };
      
    case ActionTypes.LOAD_ENTREES:
      return { ...state, entrees: action.payload };
      
    case ActionTypes.LOAD_PAIEMENTS:
      return { ...state, paiements: action.payload };
      
    case ActionTypes.LOAD_DEPENSES:
      return { ...state, depenses: action.payload };
      
    case ActionTypes.ADD_PRODUIT:
      return { ...state, produits: [...state.produits, action.payload] };
      
    case ActionTypes.UPDATE_PRODUIT:
      return {
        ...state,
        produits: state.produits.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      };
      
    case ActionTypes.DELETE_PRODUIT:
      return {
        ...state,
        produits: state.produits.filter(p => p.id !== action.payload)
      };
      
    case ActionTypes.ADD_VARIANTE:
      return {
        ...state,
        produits: state.produits.map(p => {
          if (p.id === action.payload.produitId) {
            return {
              ...p,
              variantes: [...(p.variantes || []), action.payload.variante]
            };
          }
          return p;
        })
      };
      
    case ActionTypes.UPDATE_VARIANTE:
      return {
        ...state,
        produits: state.produits.map(p => {
          if (p.id === action.payload.produitId) {
            return {
              ...p,
              variantes: p.variantes.map(v =>
                v.id === action.payload.varianteId
                  ? { ...v, ...action.payload.variante }
                  : v
              )
            };
          }
          return p;
        })
      };
      
    case ActionTypes.DELETE_VARIANTE:
      return {
        ...state,
        produits: state.produits.map(p => {
          if (p.id === action.payload.produitId) {
            return {
              ...p,
              variantes: p.variantes.filter(v => v.id !== action.payload.varianteId)
            };
          }
          return p;
        })
      };
      
    case ActionTypes.ADD_FOURNISSEUR:
      return { ...state, fournisseurs: [...state.fournisseurs, action.payload] };
      
    case ActionTypes.UPDATE_FOURNISSEUR:
      return {
        ...state,
        fournisseurs: state.fournisseurs.map(f =>
          f.id === action.payload.id ? action.payload : f
        )
      };
      
    case ActionTypes.DELETE_FOURNISSEUR:
      return {
        ...state,
        fournisseurs: state.fournisseurs.filter(f => f.id !== action.payload)
      };
      
    case ActionTypes.ADD_ENTREE:
      return { ...state, entrees: [...state.entrees, action.payload] };
      
    case ActionTypes.UPDATE_ENTREE:
      return {
        ...state,
        entrees: state.entrees.map(e =>
          e.id === action.payload.id ? action.payload : e
        )
      };
      
    case ActionTypes.DELETE_ENTREE:
      return {
        ...state,
        entrees: state.entrees.filter(e => e.id !== action.payload)
      };
      
    case ActionTypes.MARK_ENTREE_PAYEE:
      return {
        ...state,
        entrees: state.entrees.map(e =>
          e.id === action.payload ? { ...e, paye: true } : e
        )
      };
      
    case ActionTypes.ADD_PAIEMENT:
      return { ...state, paiements: [...state.paiements, action.payload] };
      
    case ActionTypes.DELETE_PAIEMENT:
      return {
        ...state,
        paiements: state.paiements.filter(p => p.id !== action.payload)
      };
      
    default:
      return state;
  }
};

// Create context
const DataContext = createContext();

// Provider component
export const DataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Load all data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    
    try {
      // Load produits with variantes
      const { data: produitsData, error: produitsError } = await supabase
        .from('produits')
        .select('*')
        .order('created_at', { ascending: false });

      if (produitsError) throw produitsError;

      // Load variantes for each product
      for (const produit of produitsData || []) {
        const { data: variantesData, error: variantesError } = await supabase
          .from('variantes')
          .select('*')
          .eq('produit_id', produit.id)
          .order('created_at', { ascending: false });

        if (!variantesError && variantesData) {
          produit.variantes = variantesData.map(v => ({
            id: v.id,
            taille: v.taille,
            couleur: v.couleur,
            modele: v.modele,
            quantite: v.quantite
          }));
        }
      }

      dispatch({ type: ActionTypes.LOAD_PRODUITS, payload: produitsData || [] });

      // Load fournisseurs
      const { data: fournisseursData, error: fournisseursError } = await supabase
        .from('fournisseurs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fournisseursError) throw fournisseursError;
      dispatch({ type: ActionTypes.LOAD_FOURNISSEURS, payload: fournisseursData || [] });

      // Load entrees with lignes
      const { data: entreesData, error: entreesError } = await supabase
        .from('entrees')
        .select('*')
        .order('created_at', { ascending: false });

      if (entreesError) throw entreesError;

      // Load lignes for each entree
      for (const entree of entreesData || []) {
        const { data: lignesData, error: lignesError } = await supabase
          .from('entree_lignes')
          .select('*')
          .eq('entree_id', entree.id);

        if (!lignesError && lignesData) {
          entree.lignes = lignesData.map(l => ({
            id: l.id,
            varianteId: l.variante_id,
            quantite: l.quantite
          }));
        }
      }

      dispatch({ type: ActionTypes.LOAD_ENTREES, payload: entreesData || [] });

      // Load paiements
      const { data: paiementsData, error: paiementsError } = await supabase
        .from('paiements')
        .select('*')
        .order('created_at', { ascending: false });

      if (paiementsError) throw paiementsError;
      dispatch({ type: ActionTypes.LOAD_PAIEMENTS, payload: paiementsData || [] });

      // Load depenses
      const { data: depensesData, error: depensesError } = await supabase
        .from('depenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (depensesError) throw depensesError;
      dispatch({ type: ActionTypes.LOAD_DEPENSES, payload: depensesData || [] });

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  // Helper functions
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Expose Supabase operations through context
  const value = {
    state,
    dispatch,
    generateId,
    loadAllData,
    supabase
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

// Hook to use the context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

// Export action types
export { ActionTypes };

