import { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state
const initialState = {
  produits: [],
  fournisseurs: [],
  entrees: [],
  paiements: [],
  depenses: [],
  colis: []
};

// Storage key
const STORAGE_KEY = 'gestion_marchandise_data';

// Load data from localStorage
const loadData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialState;
  } catch (error) {
    console.error('Error loading data:', error);
    return initialState;
  }
};

// Save data to localStorage
const saveData = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving data:', error);
  }
};

// Action types
const ActionTypes = {
  LOAD_DATA: 'LOAD_DATA',
  
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
  
  // Colis
  ADD_COLIS: 'ADD_COLIS',
  UPDATE_COLIS: 'UPDATE_COLIS',
  DELETE_COLIS: 'DELETE_COLIS',
};

// Reducer
const dataReducer = (state, action) => {
  let newState;
  
  switch (action.type) {
    case ActionTypes.LOAD_DATA:
      // Ensure all fields exist even for old data
      return {
        produits: action.payload.produits || [],
        fournisseurs: action.payload.fournisseurs || [],
        entrees: action.payload.entrees || [],
        paiements: action.payload.paiements || [],
        depenses: action.payload.depenses || [],
        colis: action.payload.colis || []
      };
      
    case ActionTypes.ADD_PRODUIT:
      newState = {
        ...state,
        produits: [...state.produits, action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_PRODUIT:
      newState = {
        ...state,
        produits: state.produits.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_PRODUIT:
      newState = {
        ...state,
        produits: state.produits.filter(p => p.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_VARIANTE:
      newState = {
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
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_VARIANTE:
      newState = {
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
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_VARIANTE:
      newState = {
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
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_FOURNISSEUR:
      newState = {
        ...state,
        fournisseurs: [...state.fournisseurs, action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_FOURNISSEUR:
      newState = {
        ...state,
        fournisseurs: state.fournisseurs.map(f =>
          f.id === action.payload.id ? action.payload : f
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_FOURNISSEUR:
      newState = {
        ...state,
        fournisseurs: state.fournisseurs.filter(f => f.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_ENTREE:
      newState = {
        ...state,
        entrees: [...state.entrees, action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_ENTREE:
      newState = {
        ...state,
        entrees: state.entrees.map(e =>
          e.id === action.payload.id ? action.payload : e
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_ENTREE:
      newState = {
        ...state,
        entrees: state.entrees.filter(e => e.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.MARK_ENTREE_PAYEE:
      newState = {
        ...state,
        entrees: state.entrees.map(e =>
          e.id === action.payload ? { ...e, paye: true } : e
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_PAIEMENT:
      newState = {
        ...state,
        paiements: [...state.paiements, action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_PAIEMENT:
      newState = {
        ...state,
        paiements: state.paiements.filter(p => p.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_DEPENSE:
      newState = {
        ...state,
        depenses: [...state.depenses, action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_DEPENSE:
      newState = {
        ...state,
        depenses: state.depenses.map(d =>
          d.id === action.payload.id ? action.payload : d
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_DEPENSE:
      newState = {
        ...state,
        depenses: state.depenses.filter(d => d.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_COLIS:
      newState = {
        ...state,
        colis: [...(state.colis || []), action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_COLIS:
      newState = {
        ...state,
        colis: (state.colis || []).map(c =>
          c.id === action.payload.id ? action.payload : c
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_COLIS:
      newState = {
        ...state,
        colis: (state.colis || []).filter(c => c.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    default:
      return state;
  }
};

// Create context
const DataContext = createContext();

// Provider component
export const DataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Load data on mount
  useEffect(() => {
    const loadedData = loadData();
    dispatch({ type: ActionTypes.LOAD_DATA, payload: loadedData });
  }, []);

  // Helper functions
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return (
    <DataContext.Provider value={{ state, dispatch, generateId }}>
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

