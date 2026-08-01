/**
 * Salariés — présentation liste uniquement.
 * Formules, acomptes, clôture/annulation, payloads, CRUD, permissions
 * et dual-path Supabase/localStorage inchangés. SalaryDetail non modifié.
 */
import { useData, ActionTypes } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageSurface } from '@/components/PageSurface';
import { StatusBadge } from '@/components/StatusBadge';
import SalaryDetail from './SalaryDetail';
import {
  Plus,
  Users,
  CreditCard,
  Trash2,
  Edit,
  Archive,
  Clock,
  UserX,
  Gift,
  Search,
  MoreHorizontal,
  ChevronRight,
  Undo2,
  AlertTriangle,
} from 'lucide-react';

const formatDa = (value) =>
  `${Number(parseFloat(value || 0).toFixed(2)).toLocaleString('fr-FR')} DA`;

const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const formatMonthLabel = (mois) => {
  if (!mois || !/^\d{4}-\d{2}$/.test(mois)) return mois || '—';
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return mois;
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-[hsl(var(--warning))]',
          tone === 'info' && 'text-[hsl(var(--info))]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

const Salaries = () => {
  const [selectedSalaryId, setSelectedSalaryId] = useState(null);

  // Si un salarié est sélectionné, afficher sa page de détail
  if (selectedSalaryId) {
    return <SalaryDetail salaryId={selectedSalaryId} onBack={() => setSelectedSalaryId(null)} />;
  }

  // Sinon, afficher la liste
  return <SalariesList onSelectSalary={setSelectedSalaryId} />;
};

const QUICK_ACTIONS = {
  retard: {
    label: 'Retard',
    montantParDefaut: '500',
    description: 'Retard',
    signe: 1,
    Icon: Clock,
    buttonClassName: 'border-red-600 text-red-700 hover:bg-red-50',
    dialogTitle: 'Enregistrer un retard',
    dialogDescription: 'Déduit un acompte de retard pour le salarié sélectionné (date du jour).',
    submitLabel: 'Enregistrer le retard',
    successMessage: (montant) => `Retard enregistré : ${montant.toFixed(2)} DA déduits`,
  },
  absence: {
    label: 'Absence',
    montantParDefaut: '1500',
    description: 'Absence',
    signe: 1,
    Icon: UserX,
    buttonClassName: 'border-orange-600 text-orange-700 hover:bg-orange-50',
    dialogTitle: 'Enregistrer une absence',
    dialogDescription: 'Déduit un acompte d\'absence pour le salarié sélectionné (date du jour).',
    submitLabel: 'Enregistrer l\'absence',
    successMessage: (montant) => `Absence enregistrée : ${montant.toFixed(2)} DA déduits`,
  },
  bonus: {
    label: 'Bonus',
    montantParDefaut: '1000',
    description: 'Bonus',
    signe: -1,
    Icon: Gift,
    buttonClassName: 'border-emerald-600 text-emerald-700 hover:bg-emerald-50',
    dialogTitle: 'Enregistrer un bonus',
    dialogDescription: 'Ajoute une prime au salarié (acompte négatif, augmente le solde restant).',
    submitLabel: 'Enregistrer le bonus',
    successMessage: (montant) => `Bonus enregistré : +${montant.toFixed(2)} DA`,
  },
};

const SalariesList = ({ onSelectSalary }) => {
  const dataCtx = useData();
  const state = dataCtx?.state ?? {
    salaries: dataCtx?.salaries ?? [],
    acomptes: dataCtx?.acomptes ?? []
  };
  const dispatch = dataCtx?.dispatch;
  const generateId = dataCtx?.generateId;
  const addSalary = dataCtx?.addSalary;
  const updateSalary = dataCtx?.updateSalary;
  const deleteSalary = dataCtx?.deleteSalary;
  const addAcompte = dataCtx?.addAcompte;
  const deleteAcompte = dataCtx?.deleteAcompte;
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [showAcompteModal, setShowAcompteModal] = useState(false);
  const [showCloseMonthDialog, setShowCloseMonthDialog] = useState(false);
  const [showUndoCloseDialog, setShowUndoCloseDialog] = useState(false);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [isUndoingClose, setIsUndoingClose] = useState(false);
  const [quickActionKey, setQuickActionKey] = useState(null);
  const [quickActionData, setQuickActionData] = useState({ salaryId: '', montant: '' });
  const [editingSalary, setEditingSalary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filters, setFilters] = useState({
    salaryId: '',
    dateStart: '',
    dateEnd: ''
  });
  const [formData, setFormData] = useState({
    nom: '',
    salaire_mensuel: '',
    contact: '',
    poste: ''
  });
  const [acompteData, setAcompteData] = useState({
    salaryId: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Charger les données au démarrage (Supabase)
  useEffect(() => {
    if (USE_SUPABASE) {
      if (dataCtx?.fetchSalaries) {
        dataCtx.fetchSalaries();
      }
      if (dataCtx?.fetchAcomptes) {
        dataCtx.fetchAcomptes();
      }
      if (dataCtx?.fetchSalaryHistory) {
        dataCtx.fetchSalaryHistory();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vérifier et clôturer automatiquement le mois précédent le 1er (snapshot, sans supprimer)
  useEffect(() => {
    const checkMonthlyReset = async () => {
      if (!USE_SUPABASE || !dataCtx?.resetMonthlySalaries || !dataCtx?.getPreviousMonth) return;

      const today = new Date();
      const currentDay = today.getDate();

      if (currentDay === 1) {
        const lastReset = localStorage.getItem('last_monthly_reset');
        const todayStr = today.toISOString().split('T')[0];

        if (lastReset !== todayStr) {
          try {
            const prevMonth = dataCtx.getPreviousMonth();
            const result = await dataCtx.resetMonthlySalaries(prevMonth);
            if (result?.success) {
              localStorage.setItem('last_monthly_reset', todayStr);
              toast({
                title: 'Clôture mensuelle',
                description: `Mois ${result.mois_annee} archivé. Les acomptes restent en base pour impression.`,
              });
              if (dataCtx?.fetchAcomptes) {
                dataCtx.fetchAcomptes();
              }
            }
          } catch (error) {
            console.error('Erreur réinitialisation mensuelle:', error);
          }
        }
      }
    };

    checkMonthlyReset();
    const interval = setInterval(checkMonthlyReset, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dataCtx, toast]);

  // Helper pour obtenir le mois actuel
  const getCurrentMonth = useCallback(() => {
    if (dataCtx?.getCurrentMonth) {
      return dataCtx.getCurrentMonth();
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [dataCtx]);

  // Mois de travail UI — défaut = mois calendaire (comportement historique)
  const effectiveMonth = selectedMonth || getCurrentMonth();

  const getAcompteMoisKey = useCallback((a) => {
    return a.mois_annee || (a.date ? String(a.date).substring(0, 7) : '');
  }, []);

  // Acomptes du mois sélectionné (solde / clôture) — l'historique reste en base
  const getSalaryAcomptes = useCallback((salaryId, { allMonths = false } = {}) => {
    const currentMonth = effectiveMonth;
    let filteredAcomptes = (state.acomptes || []).filter(a => {
      const sId = a.salary_id ?? a.salaryId;
      if (sId !== salaryId) return false;
      if (allMonths) return true;
      if (filters.dateStart || filters.dateEnd) return true; // filtres date manuels
      return getAcompteMoisKey(a) === currentMonth;
    });

    if (filters.dateStart && filters.dateEnd) {
      filteredAcomptes = filteredAcomptes.filter(a => {
        const acompteDate = a.date;
        return acompteDate >= filters.dateStart && acompteDate <= filters.dateEnd;
      });
    }

    return filteredAcomptes.reverse();
  }, [state.acomptes, filters.dateStart, filters.dateEnd, effectiveMonth, getAcompteMoisKey]);

  const calculateTotalAcomptes = useCallback((salaryId) => {
    const acomptes = getSalaryAcomptes(salaryId);
    return acomptes.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
  }, [getSalaryAcomptes]);

  const calculateSoldeRestant = useCallback((salary) => {
    const salaireMensuel = parseFloat(salary.salaire_mensuel ?? salary.salaireMensuel ?? 0);
    const totalAcomptes = calculateTotalAcomptes(salary.id);
    return salaireMensuel - totalAcomptes;
  }, [calculateTotalAcomptes]);

  // Filtrer les salariés
  const filteredSalaries = useMemo(() => {
    let list = state.salaries || [];
    if (filters.salaryId) {
      list = list.filter(s => s.id === filters.salaryId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const nom = (s.nom || '').toLowerCase();
        const poste = (s.poste || '').toLowerCase();
        const contact = (s.contact || '').toLowerCase();
        return nom.includes(q) || poste.includes(q) || contact.includes(q);
      });
    }
    return list;
  }, [state.salaries, filters.salaryId, searchQuery]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const salaries = filteredSalaries;
    const totalSalaires = salaries.reduce((sum, s) => sum + (parseFloat(s.salaire_mensuel ?? s.salaireMensuel ?? 0)), 0);
    const totalAcomptes = salaries.reduce((sum, s) => {
      return sum + calculateTotalAcomptes(s.id);
    }, 0);
    const soldeTotal = totalSalaires - totalAcomptes;
    const salariesAvecAcomptes = salaries.filter(s => calculateTotalAcomptes(s.id) > 0).length;
    
    return {
      totalSalaries: salaries.length,
      totalSalaires,
      totalAcomptes,
      soldeTotal,
      salariesAvecAcomptes,
      moyenneSalaire: salaries.length > 0 ? totalSalaires / salaries.length : 0,
      moyenneAcomptes: salaries.length > 0 ? totalAcomptes / salaries.length : 0
    };
  }, [filteredSalaries, calculateTotalAcomptes]);

  // Statistiques par période
  const periodStats = useMemo(() => {
    const today = filterByPeriod(state.acomptes || [], 'date', 'today');
    const week = filterByPeriod(state.acomptes || [], 'date', 'week');
    const month = filterByPeriod(state.acomptes || [], 'date', 'month');
    
    const calcStats = (acomptesList) => {
      const total = acomptesList.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0);
      const count = acomptesList.length;
      const moyenne = count > 0 ? total / count : 0;
      return { total, count, moyenne };
    };
    
    return {
      today: calcStats(today),
      week: calcStats(week),
      month: calcStats(month)
    };
  }, [state.acomptes]);

  const activeAcomptesStats = useMemo(() => {
    const currentMonth = effectiveMonth;
    const list = (state.acomptes || []).filter((a) => getAcompteMoisKey(a) === currentMonth);
    return {
      count: list.length,
      total: list.reduce((sum, a) => sum + (parseFloat(a.montant) || 0), 0),
      mois: currentMonth,
    };
  }, [state.acomptes, effectiveMonth, getAcompteMoisKey]);

  const availableMonths = useMemo(() => {
    const keys = new Set();
    keys.add(getCurrentMonth());
    (state.acomptes || []).forEach((a) => {
      const m = getAcompteMoisKey(a);
      if (m) keys.add(m);
    });
    (dataCtx?.salaryHistory || []).forEach((h) => {
      if (h.mois_annee) keys.add(h.mois_annee);
    });
    return Array.from(keys).sort().reverse();
  }, [state.acomptes, dataCtx?.salaryHistory, getCurrentMonth, getAcompteMoisKey]);

  const isSelectedMonthClosed = useMemo(() => {
    return (dataCtx?.salaryHistory || []).some((h) => h.mois_annee === effectiveMonth);
  }, [dataCtx?.salaryHistory, effectiveMonth]);

  const handleCloseMonth = async () => {
    if (!USE_SUPABASE || !dataCtx?.resetAllAcomptes) return;

    const { count, total, mois } = activeAcomptesStats;
    setIsClosingMonth(true);
    try {
      const result = await dataCtx.resetAllAcomptes(mois);
      if (result?.success) {
        const closedMonth = result.mois_annee || mois;
        localStorage.setItem('last_acompte_reset_batch', closedMonth);
        setShowCloseMonthDialog(false);
        if (dataCtx?.fetchAcomptes) {
          await dataCtx.fetchAcomptes();
        }
        if (dataCtx?.fetchSalaryHistory) {
          await dataCtx.fetchSalaryHistory();
        }
        toast({
          title: 'Mois clôturé',
          description: `${closedMonth} : ${count} acompte(s) conservés (${total.toFixed(2)} DA). Historique enregistré.`,
          action: (
            <ToastAction
              altText="Annuler"
              onClick={async () => {
                try {
                  await dataCtx.undoResetAcomptes(closedMonth);
                  localStorage.removeItem('last_acompte_reset_batch');
                  toast({
                    title: 'Annulation réussie',
                    description: 'Le snapshot d’historique a été retiré. Les acomptes restent en base.',
                  });
                } catch (e) {
                  toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: e?.message || "Impossible d'annuler la clôture",
                  });
                }
              }}
            >
              Annuler
            </ToastAction>
          ),
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Impossible de clôturer le mois',
      });
    } finally {
      setIsClosingMonth(false);
    }
  };

  const handleUndoCloseMonth = async () => {
    if (!USE_SUPABASE || !dataCtx?.undoResetAcomptes) return;
    setIsUndoingClose(true);
    try {
      await dataCtx.undoResetAcomptes(effectiveMonth);
      localStorage.removeItem('last_acompte_reset_batch');
      if (dataCtx?.fetchSalaryHistory) {
        await dataCtx.fetchSalaryHistory();
      }
      setShowUndoCloseDialog(false);
      toast({
        title: 'Annulation réussie',
        description: 'Le snapshot d’historique a été retiré. Les acomptes restent en base.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || "Impossible d'annuler la clôture",
      });
    } finally {
      setIsUndoingClose(false);
    }
  };

  const handleAddSalary = async () => {
    if (!formData.nom || !formData.salaire_mensuel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom et le salaire mensuel",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await addSalary(formData.nom, formData.salaire_mensuel, formData.contact, formData.poste);
      } else {
        const newSalary = {
          id: generateId(),
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact || '',
          poste: formData.poste || ''
        };
        dispatch({ type: ActionTypes.ADD_SALARY, payload: newSalary });
      }
      setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
      setShowModal(false);
      toast({
        title: "Succès",
        description: "Salarié ajouté avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleUpdateSalary = async () => {
    if (!formData.nom || !formData.salaire_mensuel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom et le salaire mensuel",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        await updateSalary(editingSalary.id, {
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact,
          poste: formData.poste
        });
      } else {
        const updatedSalary = {
          ...editingSalary,
          nom: formData.nom,
          salaire_mensuel: parseFloat(formData.salaire_mensuel),
          contact: formData.contact || '',
          poste: formData.poste || ''
        };
        dispatch({ type: ActionTypes.UPDATE_SALARY, payload: updatedSalary });
      }
      setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
      setShowModal(false);
      setEditingSalary(null);
      toast({
        title: "Succès",
        description: "Salarié mis à jour avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleDeleteSalary = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce salarié ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteSalary(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_SALARY, payload: id });
      }
      toast({
        title: "Succès",
        description: "Salarié supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
    }
  };

  const handleAddAcompte = async () => {
    if (!acompteData.salaryId || !acompteData.montant || !acompteData.date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    try {
      if (USE_SUPABASE) {
        const dateFormatted = acompteData.date.includes('T') 
          ? acompteData.date.split('T')[0] 
          : acompteData.date;
        await addAcompte(acompteData.salaryId, acompteData.montant, dateFormatted, acompteData.description || '');
      } else {
        const dateFormatted = acompteData.date.includes('T') 
          ? acompteData.date.split('T')[0] 
          : acompteData.date;
        const newAcompte = {
          id: generateId(),
          salaryId: acompteData.salaryId,
          montant: parseFloat(acompteData.montant),
          date: dateFormatted,
          description: acompteData.description || ''
        };
        dispatch({ type: ActionTypes.ADD_ACOMPTE, payload: newAcompte });
      }

      setAcompteData({
        salaryId: '',
        montant: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setShowAcompteModal(false);
      
      toast({
        title: "Succès",
        description: "Acompte enregistré avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleAddAcompte:', e);
    }
  };

  const handleDeleteAcompte = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet acompte ?')) {
      return;
    }

    try {
      if (USE_SUPABASE) {
        await deleteAcompte(id);
      } else {
        dispatch({ type: ActionTypes.DELETE_ACOMPTE, payload: id });
      }
      toast({
        title: "Succès",
        description: "Acompte supprimé avec succès",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleDeleteAcompte:', e);
    }
  };

  const activeQuickAction = quickActionKey ? QUICK_ACTIONS[quickActionKey] : null;

  const openQuickAction = (key) => {
    const action = QUICK_ACTIONS[key];
    setQuickActionKey(key);
    setQuickActionData({ salaryId: '', montant: action.montantParDefaut });
  };

  const closeQuickAction = () => {
    setQuickActionKey(null);
    setQuickActionData({ salaryId: '', montant: '' });
  };

  const handleQuickActionSubmit = async () => {
    if (!quickActionKey || !activeQuickAction) return;

    if (!quickActionData.salaryId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un salarié',
      });
      return;
    }

    const montantSaisi = parseFloat(quickActionData.montant) || 0;
    const montantApi =
      activeQuickAction.signe === -1 ? -Math.abs(montantSaisi) : montantSaisi;
    const montantAffiche =
      activeQuickAction.signe === -1 ? Math.abs(montantSaisi) : montantSaisi;
    const dateToday = new Date().toISOString().split('T')[0];

    try {
      if (USE_SUPABASE) {
        await addAcompte(
          quickActionData.salaryId,
          montantApi,
          dateToday,
          activeQuickAction.description
        );
        if (dataCtx?.fetchAcomptes) {
          await dataCtx.fetchAcomptes();
        }
      } else {
        const newAcompte = {
          id: generateId(),
          salaryId: quickActionData.salaryId,
          montant: montantApi,
          date: dateToday,
          description: activeQuickAction.description,
        };
        dispatch({ type: ActionTypes.ADD_ACOMPTE, payload: newAcompte });
      }

      closeQuickAction();
      toast({
        title: 'Succès',
        description: activeQuickAction.successMessage(montantAffiche),
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message || 'Erreur inconnue',
      });
      console.error('Erreur handleQuickActionSubmit:', e);
    }
  };

  const openEditModal = (salary) => {
    setEditingSalary(salary);
    setFormData({
      nom: salary.nom,
      salaire_mensuel: salary.salaire_mensuel ?? salary.salaireMensuel ?? '',
      contact: salary.contact || '',
      poste: salary.poste || ''
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingSalary(null);
    setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
    setShowModal(true);
  };

  const hasActiveFilters =
    Boolean(filters.salaryId || filters.dateStart || filters.dateEnd) ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setFilters({ salaryId: '', dateStart: '', dateEnd: '' });
    setSearchQuery('');
  };

  const salaryEtat = (totalAcomptes, soldeRestant) => {
    if (totalAcomptes === 0) {
      return { status: 'info', label: 'Sans acompte' };
    }
    if (soldeRestant > 0) {
      return { status: 'en_attente', label: 'Reste à payer' };
    }
    if (soldeRestant < 0) {
      return { status: 'info', label: 'Crédit' };
    }
    return { status: 'paye', label: 'Soldé' };
  };

  // Référence volontaire — CRUD acompte conservé (utilisé côté détail / futurs usages)
  void handleDeleteAcompte;

  return (
    <PageSurface className="space-y-6">
      <PageHeader
        eyebrow="Opérations"
        title="Salariés"
        description="Paie mensuelle, acomptes et événements — sans altérer les règles financières."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAcompteModal(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Nouvel acompte
            </Button>
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau salarié
            </Button>
          </div>
        }
      />

      {/* Mois + état de clôture */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-month">
              Mois sélectionné
            </label>
            <select
              id="salary-month"
              value={effectiveMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex h-9 w-full min-w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
          </div>
          <div className="pb-1">
            {isSelectedMonthClosed ? (
              <StatusBadge status="valide" label="Mois clôturé" />
            ) : (
              <StatusBadge status="en_attente" label="Mois ouvert" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {USE_SUPABASE && isSelectedMonthClosed && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowUndoCloseDialog(true)}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Annuler la clôture
            </Button>
          )}
          {USE_SUPABASE && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[hsl(var(--warning)/0.55)] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.1)]"
              disabled={activeAcomptesStats.count === 0}
              onClick={() => setShowCloseMonthDialog(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Clôturer le mois
            </Button>
          )}
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4 lg:grid-cols-4">
        <MetaStat label="Masse salariale" value={formatDa(globalStats.totalSalaires)} tone="info" />
        <MetaStat label="Acomptes" value={formatDa(globalStats.totalAcomptes)} tone="warning" />
        <MetaStat
          label="Reste à payer"
          value={formatDa(globalStats.soldeTotal)}
          tone={globalStats.soldeTotal >= 0 ? 'success' : 'danger'}
        />
        <MetaStat label="Salariés" value={formatNum(globalStats.totalSalaries)} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card px-4 py-3 sm:grid-cols-4">
        <MetaStat label="Moy. salaire" value={formatDa(globalStats.moyenneSalaire)} />
        <MetaStat label="Moy. acomptes" value={formatDa(globalStats.moyenneAcomptes)} />
        <MetaStat
          label="Avec acomptes"
          value={formatNum(globalStats.salariesAvecAcomptes)}
          tone="info"
        />
        <MetaStat
          label="Taux versé"
          value={`${
            globalStats.totalSalaires > 0
              ? ((globalStats.totalAcomptes / globalStats.totalSalaires) * 100).toFixed(1)
              : 0
          } %`}
        />
      </div>

      {/* Périodes acomptes (calendaire — inchangé) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { key: 'today', label: "Aujourd'hui", stats: periodStats.today },
          { key: 'week', label: 'Cette semaine', stats: periodStats.week },
          { key: 'month', label: 'Ce mois', stats: periodStats.month },
        ].map(({ key, label, stats: ps }) => (
          <div key={key} className="rounded-lg border border-border/80 bg-card px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatDa(ps.total)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Nb</p>
                <p className="font-medium tabular-nums text-foreground">{formatNum(ps.count)}</p>
              </div>
              <div>
                <p>Moy.</p>
                <p className="font-medium tabular-nums text-foreground">{formatDa(ps.moyenne)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions rapides */}
      <section className="flex flex-wrap gap-2">
        {Object.entries(QUICK_ACTIONS).map(([key, action]) => {
          const ActionIcon = action.Icon;
          return (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="outline"
              className={action.buttonClassName}
              onClick={() => openQuickAction(key)}
            >
              <ActionIcon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </section>

      {/* Recherche + filtres */}
      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-search">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="salary-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, poste, contact…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-filter">
            Salarié
          </label>
          <select
            id="salary-filter"
            value={filters.salaryId}
            onChange={(e) => setFilters({ ...filters, salaryId: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Tous les salariés</option>
            {(state.salaries || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-start">
            Date début
          </label>
          <Input
            id="salary-start"
            type="date"
            value={filters.dateStart}
            onChange={(e) => setFilters({ ...filters, dateStart: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-end">
            Date fin
          </label>
          <Input
            id="salary-end"
            type="date"
            value={filters.dateEnd}
            onChange={(e) => setFilters({ ...filters, dateEnd: e.target.value })}
            className="h-9"
          />
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </section>

      {/* Liste */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Effectif — {formatMonthLabel(effectiveMonth)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {(!state.salaries || state.salaries.length === 0)
              ? 'Aucun salarié'
              : `${formatNum(filteredSalaries.length)} salarié(s)${
                  hasActiveFilters ? ' (filtrés)' : ''
                } · acomptes du mois ${activeAcomptesStats.count}`}
          </p>
        </div>

        {(!state.salaries || state.salaries.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun salarié</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoutez un salarié pour démarrer la paie
            </p>
            <Button className="mt-4" size="sm" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau salarié
            </Button>
          </div>
        ) : filteredSalaries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun salarié trouvé</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun résultat pour les critères sélectionnés
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Salarié</th>
                    <th className="px-3 py-2.5 font-medium">Poste</th>
                    <th className="px-3 py-2.5 text-right font-medium">Salaire</th>
                    <th className="px-3 py-2.5 text-right font-medium">Acomptes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Solde</th>
                    <th className="px-3 py-2.5 font-medium">État</th>
                    <th className="w-12 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaries.map((salary) => {
                    const salaireMensuel = parseFloat(
                      salary.salaire_mensuel ?? salary.salaireMensuel ?? 0
                    );
                    const totalAcomptes = calculateTotalAcomptes(salary.id);
                    const soldeRestant = calculateSoldeRestant(salary);
                    const etat = salaryEtat(totalAcomptes, soldeRestant);
                    return (
                      <tr
                        key={salary.id}
                        className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20"
                        onClick={() => onSelectSalary(salary.id)}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{salary.nom}</p>
                          {salary.contact ? (
                            <p className="text-xs text-muted-foreground">{salary.contact}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {salary.poste || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatDa(salaireMensuel)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[hsl(var(--warning))]">
                          {formatDa(totalAcomptes)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right font-semibold tabular-nums',
                            soldeRestant >= 0 ? 'text-success' : 'text-danger'
                          )}
                        >
                          {formatDa(soldeRestant)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={etat.status} label={etat.label} />
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => onSelectSalary(salary.id)}>
                                <ChevronRight className="mr-2 h-4 w-4" />
                                Voir le détail
                              </DropdownMenuItem>
                              {isAdmin() && (
                                <>
                                  <DropdownMenuItem onClick={() => openEditModal(salary)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteSalary(salary.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {filteredSalaries.map((salary) => {
                const salaireMensuel = parseFloat(
                  salary.salaire_mensuel ?? salary.salaireMensuel ?? 0
                );
                const totalAcomptes = calculateTotalAcomptes(salary.id);
                const soldeRestant = calculateSoldeRestant(salary);
                const etat = salaryEtat(totalAcomptes, soldeRestant);
                return (
                  <div
                    key={salary.id}
                    className="cursor-pointer rounded-lg border border-border/80 bg-card px-3 py-3"
                    onClick={() => onSelectSalary(salary.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectSalary(salary.id);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{salary.nom}</p>
                        <p className="text-xs text-muted-foreground">
                          {salary.poste || 'Sans poste'}
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={etat.status} label={etat.label} />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-1" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <p
                            className={cn(
                              'text-base font-semibold tabular-nums',
                              soldeRestant >= 0 ? 'text-success' : 'text-danger'
                            )}
                          >
                            {formatDa(soldeRestant)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">solde</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onSelectSalary(salary.id)}>
                              <ChevronRight className="mr-2 h-4 w-4" />
                              Voir le détail
                            </DropdownMenuItem>
                            {isAdmin() && (
                              <>
                                <DropdownMenuItem onClick={() => openEditModal(salary)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteSalary(salary.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Salaire</p>
                        <p className="font-medium tabular-nums">{formatDa(salaireMensuel)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Acomptes</p>
                        <p className="font-medium tabular-nums text-[hsl(var(--warning))]">
                          {formatDa(totalAcomptes)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Dialog salarié */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            setEditingSalary(null);
            setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSalary ? 'Modifier le salarié' : 'Nouveau salarié'}</DialogTitle>
            <DialogDescription>
              {editingSalary
                ? 'Modifiez les informations du salarié'
                : 'Ajoutez un nouveau salarié à votre base de données'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sal-nom">
                Nom *
              </label>
              <Input
                id="sal-nom"
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sal-salaire">
                Salaire mensuel (DA) *
              </label>
              <Input
                id="sal-salaire"
                type="number"
                step="0.01"
                value={formData.salaire_mensuel}
                onChange={(e) => setFormData({ ...formData, salaire_mensuel: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sal-contact">
                Contact
              </label>
              <Input
                id="sal-contact"
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="sal-poste">
                Poste
              </label>
              <Input
                id="sal-poste"
                type="text"
                value={formData.poste}
                onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingSalary(null);
                setFormData({ nom: '', salaire_mensuel: '', contact: '', poste: '' });
              }}
            >
              Annuler
            </Button>
            <Button onClick={editingSalary ? handleUpdateSalary : handleAddSalary}>
              {editingSalary ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog acompte */}
      <Dialog open={showAcompteModal} onOpenChange={setShowAcompteModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel acompte</DialogTitle>
            <DialogDescription>
              Enregistrez un nouvel acompte pour un salarié
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Salarié *</label>
              <select
                value={acompteData.salaryId}
                onChange={(e) => setAcompteData({ ...acompteData, salaryId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sélectionner</option>
                {(state.salaries || []).map((salary) => {
                  const solde = calculateSoldeRestant(salary);
                  const salaireMensuel = parseFloat(
                    salary.salaire_mensuel ?? salary.salaireMensuel ?? 0
                  );
                  return (
                    <option key={salary.id} value={salary.id}>
                      {salary.nom} - Salaire: {salaireMensuel.toFixed(2)} DA (Solde: {solde.toFixed(2)} DA)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Montant (DA) *</label>
              <Input
                type="number"
                step="0.01"
                value={acompteData.montant}
                onChange={(e) => setAcompteData({ ...acompteData, montant: e.target.value })}
              />
            </div>

            {acompteData.salaryId && (
              <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-3">
                {(() => {
                  const salary = (state.salaries || []).find((s) => s.id === acompteData.salaryId);
                  if (!salary) return null;
                  const salaireMensuel = parseFloat(
                    salary.salaire_mensuel ?? salary.salaireMensuel ?? 0
                  );
                  const totalAcomptes = calculateTotalAcomptes(salary.id);
                  const soldeActuel = salaireMensuel - totalAcomptes;
                  const montantAcompte = parseFloat(acompteData.montant) || 0;
                  const nouveauSolde = soldeActuel - montantAcompte;

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Salaire mensuel:</span>
                        <span className="font-semibold">{salaireMensuel.toFixed(2)} DA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total acomptes:</span>
                        <span className="font-semibold text-orange-600">
                          {totalAcomptes.toFixed(2)} DA
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Solde actuel:</span>
                        <span className="font-semibold">{soldeActuel.toFixed(2)} DA</span>
                      </div>
                      {montantAcompte > 0 && (
                        <>
                          <Separator />
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Nouvel acompte:</span>
                            <span className="font-semibold text-red-600">
                              -{montantAcompte.toFixed(2)} DA
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Nouveau solde:</span>
                            <span
                              className={`text-lg font-bold ${
                                nouveauSolde >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {nouveauSolde.toFixed(2)} DA
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={acompteData.date}
                onChange={(e) => setAcompteData({ ...acompteData, date: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <Textarea
                value={acompteData.description}
                onChange={(e) => setAcompteData({ ...acompteData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAcompteModal(false);
                setAcompteData({
                  salaryId: '',
                  montant: '',
                  date: new Date().toISOString().split('T')[0],
                  description: '',
                });
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleAddAcompte}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog quick actions */}
      <Dialog
        open={quickActionKey !== null}
        onOpenChange={(open) => {
          if (!open) closeQuickAction();
        }}
      >
        <DialogContent>
          {activeQuickAction && (
            <>
              <DialogHeader>
                <DialogTitle>{activeQuickAction.dialogTitle}</DialogTitle>
                <DialogDescription>{activeQuickAction.dialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Salarié *</label>
                  <select
                    value={quickActionData.salaryId}
                    onChange={(e) =>
                      setQuickActionData({ ...quickActionData, salaryId: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sélectionner</option>
                    {(state.salaries || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Montant (DA) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quickActionData.montant}
                    onChange={(e) =>
                      setQuickActionData({ ...quickActionData, montant: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeQuickAction}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleQuickActionSubmit}>
                  {activeQuickAction.submitLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog clôture */}
      <Dialog open={showCloseMonthDialog} onOpenChange={setShowCloseMonthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer le mois</DialogTitle>
            <DialogDescription>
              Enregistre un snapshot du mois {activeAcomptesStats.mois} dans l&apos;historique.
              Tous les acomptes restent en base et restent imprimables plus tard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Mois</span>
              <span className="font-semibold">{activeAcomptesStats.mois}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Acomptes du mois</span>
              <span className="font-semibold">{activeAcomptesStats.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Montant total</span>
              <span className="font-semibold text-orange-600">
                {activeAcomptesStats.total.toFixed(2)} DA
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Aucune suppression : le mois suivant démarre vide à l&apos;écran, l&apos;historique
            reste consultable et imprimable.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseMonthDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCloseMonth}
              disabled={isClosingMonth || activeAcomptesStats.count === 0}
              className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]/90"
            >
              {isClosingMonth ? 'Clôture…' : 'Confirmer la clôture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog annulation clôture */}
      <Dialog open={showUndoCloseDialog} onOpenChange={setShowUndoCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la clôture</DialogTitle>
            <DialogDescription>
              Retire le snapshot d&apos;historique du mois {effectiveMonth}. Les acomptes restent
              en base — aucune suppression.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm">
            <p>
              Mois : <span className="font-semibold">{effectiveMonth}</span>
            </p>
            <p className="mt-1 text-muted-foreground">
              {formatMonthLabel(effectiveMonth)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUndoCloseDialog(false)}>
              Fermer
            </Button>
            <Button
              variant="destructive"
              onClick={handleUndoCloseMonth}
              disabled={isUndoingClose}
            >
              {isUndoingClose ? 'Annulation…' : 'Confirmer l’annulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSurface>
  );
};

export default Salaries;
