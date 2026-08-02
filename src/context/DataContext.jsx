import { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import {
  assertCanMutateAcompte,
  assertCanRestoreAcompte,
} from '../utils/acompteAuditActor';

// Initial state
const initialState = {
  produits: [],
  fournisseurs: [],
  entrees: [],
  paiements: [],
  depenses: [],
  colis: [],
  salaries: [],
  acomptes: []
};

// Storage key
const STORAGE_KEY = 'gestion_marchandise_data';
const ACOMPTE_AUDIT_STORAGE_KEY = 'gestion_marchandise_acompte_audit_logs';
const LOCAL_SALARY_HISTORY_KEY = 'gestion_marchandise_salary_history';

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

function loadAcompteAuditLogs() {
  try {
    const raw = localStorage.getItem(ACOMPTE_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Append-only : jamais de modification / suppression d'un log existant */
function appendAcompteAuditLog(entry) {
  const logs = loadAcompteAuditLogs();
  logs.unshift(entry);
  localStorage.setItem(ACOMPTE_AUDIT_STORAGE_KEY, JSON.stringify(logs));
  return logs;
}

function loadLocalSalaryHistory() {
  try {
    const raw = localStorage.getItem(LOCAL_SALARY_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function isLocalMonthClosed(moisAnnee) {
  return loadLocalSalaryHistory().some((h) => h.mois_annee === moisAnnee);
}

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
  
  // Salaries
  ADD_SALARY: 'ADD_SALARY',
  UPDATE_SALARY: 'UPDATE_SALARY',
  DELETE_SALARY: 'DELETE_SALARY',
  
  // Acomptes
  ADD_ACOMPTE: 'ADD_ACOMPTE',
  /** Soft-delete (conserve la ligne) — ne retire plus physiquement */
  DELETE_ACOMPTE: 'DELETE_ACOMPTE',
  RESTORE_ACOMPTE: 'RESTORE_ACOMPTE',
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
        colis: action.payload.colis || [],
        salaries: action.payload.salaries || [],
        acomptes: action.payload.acomptes || []
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
      
    case ActionTypes.ADD_SALARY:
      newState = {
        ...state,
        salaries: [...(state.salaries || []), action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.UPDATE_SALARY:
      newState = {
        ...state,
        salaries: (state.salaries || []).map(s =>
          s.id === action.payload.id ? action.payload : s
        )
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_SALARY:
      newState = {
        ...state,
        salaries: (state.salaries || []).filter(s => s.id !== action.payload)
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.ADD_ACOMPTE:
      newState = {
        ...state,
        acomptes: [...(state.acomptes || []), action.payload]
      };
      saveData(newState);
      return newState;
      
    case ActionTypes.DELETE_ACOMPTE: {
      // Soft delete uniquement — jamais de filter() destructif
      const { id, deleted_at, deleted_by_account_id, deleted_by_username, deleted_by_name, deleted_by_role, deletion_reason } = action.payload;
      newState = {
        ...state,
        acomptes: (state.acomptes || []).map((a) =>
          a.id === id
            ? {
                ...a,
                deleted_at,
                deleted_by_account_id,
                deleted_by_username,
                deleted_by_name,
                deleted_by_role,
                deletion_reason,
              }
            : a
        ),
      };
      saveData(newState);
      return newState;
    }

    case ActionTypes.RESTORE_ACOMPTE: {
      const { id, restored_at, restored_by_account_id, restored_by_username, restored_by_name, restored_by_role } = action.payload;
      newState = {
        ...state,
        acomptes: (state.acomptes || []).map((a) =>
          a.id === id
            ? {
                ...a,
                deleted_at: null,
                restored_at,
                restored_by_account_id,
                restored_by_username,
                restored_by_name,
                restored_by_role,
                // conserve deleted_by_* + deletion_reason
              }
            : a
        ),
      };
      saveData(newState);
      return newState;
    }
      
    default:
      return state;
  }
};

// Create context
const DataContext = createContext();

// Provider component
export const DataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const [salaryHistory, setSalaryHistory] = useState([]);

  // Load data on mount
  useEffect(() => {
    const loadedData = loadData();
    dispatch({ type: ActionTypes.LOAD_DATA, payload: loadedData });
    setSalaryHistory(loadLocalSalaryHistory());
  }, []);

  // Helper functions
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const getCurrentMonth = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const getAcompteMoisKey = (a) =>
    a.mois_annee || (a.date ? String(a.date).substring(0, 7) : '');

  /** Acomptes actifs exposés (soft-supprimés exclus des listes / calculs) */
  const acomptesActifs = (state.acomptes || []).filter((a) => !a.deleted_at);

  const addAcompte = useCallback(
    async (salary_id, montant, date, description, actor) => {
      assertCanMutateAcompte(actor);
      const dateFormatted = date ? String(date).split('T')[0] : null;
      if (!dateFormatted) {
        throw new Error('Date invalide : la date est obligatoire.');
      }
      const montantNum = parseFloat(montant);
      if (!montantNum || Number.isNaN(montantNum)) {
        throw new Error('Montant invalide : doit être non nul et différent de zéro.');
      }
      const mois_annee = dateFormatted.substring(0, 7);
      if (isLocalMonthClosed(mois_annee)) {
        throw new Error(
          "Ce mois est clôturé. Annulez d'abord la clôture avant d'ajouter un acompte."
        );
      }
      const salary = (state.salaries || []).find((s) => s.id === salary_id);
      if (!salary) {
        throw new Error('Salarié introuvable.');
      }

      const nowIso = new Date().toISOString();
      const id = generateId();
      const newAcompte = {
        id,
        salary_id,
        salaryId: salary_id,
        montant: montantNum,
        date: dateFormatted,
        mois_annee,
        description: description || '',
        created_at: nowIso,
        created_by_account_id: actor.account_id,
        created_by_username: actor.username,
        created_by_name: actor.name,
        created_by_role: actor.role,
        deleted_at: null,
      };
      dispatch({ type: ActionTypes.ADD_ACOMPTE, payload: newAcompte });
      appendAcompteAuditLog({
        log_id: generateId(),
        log_created_at: nowIso,
        action: 'acompte.created',
        actor_account_id: actor.account_id,
        actor_username: actor.username,
        actor_name: actor.name,
        actor_role: actor.role,
        entity_id: id,
        acompte_id: id,
        salary_id,
        salary_nom: salary.nom,
        montant: montantNum,
        acompte_date: dateFormatted,
        mois_annee,
        description: description || '',
        deletion_reason: null,
        acompte_status: 'actif',
      });
      return { success: true, data: newAcompte };
    },
    [state.salaries]
  );

  const deleteAcompte = useCallback(
    async (id, reason, actor) => {
      assertCanMutateAcompte(actor);
      const motif = String(reason || '').trim();
      if (!motif) {
        throw new Error('Le motif de la suppression est obligatoire.');
      }
      const row = (state.acomptes || []).find((a) => a.id === id);
      if (!row) throw new Error('Acompte introuvable.');
      if (row.deleted_at) throw new Error('Cet acompte est déjà supprimé.');
      const mois = getAcompteMoisKey(row);
      if (mois && isLocalMonthClosed(mois)) {
        throw new Error(
          "Ce mois est clôturé. Annulez d'abord la clôture avant de supprimer cet acompte."
        );
      }
      const nowIso = new Date().toISOString();
      dispatch({
        type: ActionTypes.DELETE_ACOMPTE,
        payload: {
          id,
          deleted_at: nowIso,
          deleted_by_account_id: actor.account_id,
          deleted_by_username: actor.username,
          deleted_by_name: actor.name,
          deleted_by_role: actor.role,
          deletion_reason: motif,
        },
      });
      const salary = (state.salaries || []).find(
        (s) => s.id === (row.salary_id ?? row.salaryId)
      );
      appendAcompteAuditLog({
        log_id: generateId(),
        log_created_at: nowIso,
        action: 'acompte.deleted',
        actor_account_id: actor.account_id,
        actor_username: actor.username,
        actor_name: actor.name,
        actor_role: actor.role,
        entity_id: id,
        acompte_id: id,
        salary_id: row.salary_id ?? row.salaryId,
        salary_nom: salary?.nom,
        montant: row.montant,
        acompte_date: row.date,
        mois_annee: mois,
        description: row.description,
        deletion_reason: motif,
        acompte_status: 'supprimé',
      });
      return { success: true };
    },
    [state.acomptes, state.salaries]
  );

  const restoreAcompte = useCallback(
    async (id, actor) => {
      assertCanRestoreAcompte(actor);
      const row = (state.acomptes || []).find((a) => a.id === id);
      if (!row) throw new Error('Acompte introuvable.');
      if (!row.deleted_at) throw new Error("Cet acompte n'est pas supprimé.");
      const mois = getAcompteMoisKey(row);
      if (mois && isLocalMonthClosed(mois)) {
        throw new Error(
          "Ce mois est clôturé. Annulez d'abord la clôture avant de restaurer cet acompte."
        );
      }
      const nowIso = new Date().toISOString();
      dispatch({
        type: ActionTypes.RESTORE_ACOMPTE,
        payload: {
          id,
          restored_at: nowIso,
          restored_by_account_id: actor.account_id,
          restored_by_username: actor.username,
          restored_by_name: actor.name,
          restored_by_role: 'admin',
        },
      });
      const salary = (state.salaries || []).find(
        (s) => s.id === (row.salary_id ?? row.salaryId)
      );
      appendAcompteAuditLog({
        log_id: generateId(),
        log_created_at: nowIso,
        action: 'acompte.restored',
        actor_account_id: actor.account_id,
        actor_username: actor.username,
        actor_name: actor.name,
        actor_role: actor.role,
        entity_id: id,
        acompte_id: id,
        salary_id: row.salary_id ?? row.salaryId,
        salary_nom: salary?.nom,
        montant: row.montant,
        acompte_date: row.date,
        mois_annee: mois,
        description: row.description,
        deletion_reason: row.deletion_reason,
        acompte_status: 'restauré',
      });
      return { success: true };
    },
    [state.acomptes, state.salaries]
  );

  const fetchAcompteAuditLogs = useCallback(async (filters = {}, actor) => {
    assertCanRestoreAcompte(actor);
    let logs = loadAcompteAuditLogs();
    const {
      limit = 50,
      offset = 0,
      action = null,
      actorUsername = null,
      salaryId = null,
      dateFrom = null,
      dateTo = null,
      deletedOnly = false,
    } = filters;

    if (action) logs = logs.filter((l) => l.action === action);
    if (actorUsername) {
      const q = String(actorUsername).trim().toLowerCase();
      logs = logs.filter((l) => (l.actor_username || '').toLowerCase().includes(q));
    }
    if (salaryId) logs = logs.filter((l) => l.salary_id === salaryId);
    if (dateFrom) logs = logs.filter((l) => l.log_created_at >= dateFrom);
    if (dateTo) logs = logs.filter((l) => l.log_created_at <= dateTo);
    if (deletedOnly) {
      logs = logs.filter(
        (l) => l.action === 'acompte.deleted' || l.acompte_status === 'supprimé'
      );
    }

    const page = logs.slice(offset, offset + Math.min(Math.max(limit, 1), 100));
    return { success: true, data: page };
  }, []);

  return (
    <DataContext.Provider
      value={{
        state: { ...state, acomptes: acomptesActifs },
        /** Toutes les lignes y compris soft-supprimées (restauration / debug local) */
        acomptesAll: state.acomptes,
        acomptes: acomptesActifs,
        salaries: state.salaries,
        salaryHistory,
        dispatch,
        generateId,
        addAcompte,
        deleteAcompte,
        restoreAcompte,
        fetchAcompteAuditLogs,
        getCurrentMonth,
      }}
    >
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

