/**
 * Dashboard — présentation uniquement.
 * Calculs, requêtes, filtres en_attente/paye et gates isAdmin inchangés.
 */
import { useData } from '../context/UnifiedDataContext';
import { USE_SUPABASE } from '../config';
import { useMemo, useState, useEffect } from 'react';
import { filterByPeriod } from '../utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Download,
  Package,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const formatDa = (n) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
const formatNum = (n) => Number(n || 0).toLocaleString('fr-FR');

/** Tuile KPI purement visuelle */
function KpiTile({ label, value, hint, icon: Icon, tone = 'default', className }) {
  const tones = {
    default: 'text-foreground',
    danger: 'text-danger',
    success: 'text-success',
    info: 'text-info',
    muted: 'text-muted-foreground',
  };
  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-card px-4 py-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn('truncate text-xl font-semibold tracking-tight sm:text-2xl', tones[tone])}>
            {value}
          </p>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
            <Icon className={cn('h-4 w-4', tones[tone] === 'text-foreground' ? 'text-muted-foreground' : tones[tone])} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Indicateur secondaire compact */
function MetaStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyBlock({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function Section({ title, description, children, className }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div>
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

const Dashboard = () => {
  const dataCtx = useData();
  const { isAdmin } = useAuth();
  const state = dataCtx?.state ?? {
    produits: dataCtx?.produits ?? [],
    fournisseurs: dataCtx?.fournisseurs ?? [],
    entrees: dataCtx?.entrees ?? [],
    paiements: dataCtx?.paiements ?? [],
    depenses: dataCtx?.depenses ?? []
  };
  const { toast } = useToast();

  // État pour stocker les détails des entrées (lignes) en mode Supabase
  const [entreesDetails, setEntreesDetails] = useState({});

  // Charger toutes les lignes d'entrée en une seule requête (vue agrégée)
  useEffect(() => {
    if (!USE_SUPABASE || !dataCtx?.supabase) return;

    const loadAllEntreesDetails = async () => {
      try {
        let allRows = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error, count } = await dataCtx.supabase
            .from('v_entree_lignes_detail')
            .select('entree_id, statut, produit_id, prix_achat, qte_envoyee, qte_recue', { count: 'exact' })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            page++;
            hasMore = data.length === pageSize && (count === null || allRows.length < count);
          } else {
            hasMore = false;
          }
        }

        const details = {};
        for (const row of allRows) {
          const entreeId = row.entree_id;
          if (!details[entreeId]) details[entreeId] = [];
          details[entreeId].push({
            produit_id: row.produit_id,
            prix_achat: row.prix_achat,
            qte_recue: row.qte_recue,
          });
        }
        setEntreesDetails(details);
      } catch (e) {
        console.error('Erreur chargement lignes détail:', e);
        setEntreesDetails({});
      }
    };

    loadAllEntreesDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cosmos-algerie-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export réussi",
      description: "Les données ont été exportées avec succès",
    });
  };

  const getFournisseurName = (fournisseurId) => {
    const fournisseur = (state.fournisseurs || []).find(f => {
      const fId = f.id;
      const entreeFId = fournisseurId?.fournisseur_id ?? fournisseurId?.fournisseurId ?? fournisseurId;
      return fId === entreeFId;
    });
    return fournisseur ? fournisseur.nom : 'Inconnu';
  };

  // Calculer TOUTES les statistiques disponibles
  const allStats = useMemo(() => {
    const produits = state.produits || [];
    const fournisseurs = state.fournisseurs || [];
    const entrees = state.entrees || [];
    const paiements = state.paiements || [];
    const depenses = state.depenses || [];

    // ========== PRODUITS ==========
    const totalProduits = produits.length;
    const valeurTotaleProduits = produits.reduce((sum, p) => {
      return sum + (p.prix_achat ?? p.prixAchat ?? 0);
    }, 0);
    const prixMoyenProduits = totalProduits > 0 ? valeurTotaleProduits / totalProduits : 0;
    const produitsAvecReference = produits.filter(p => p.reference && p.reference.trim()).length;

    // ========== FOURNISSEURS ==========
    const totalFournisseurs = fournisseurs.length;
    
    // ========== ENTRÉES ==========
    const totalEntrees = entrees.length;
    let totalValeurEntrees = 0;
    let totalValeurEntreesPayees = 0;
    let totalValeurEntreesNonPayees = 0;
    let totalEntreesPayees = 0;
    let totalEntreesNonPayees = 0;
    let totalProduitsReçus = 0;
    
    entrees.forEach((entree) => {
      if (USE_SUPABASE && entree.statut === 'en_attente') return;

      let entreeValue = 0;
      let produitsCount = 0;

      if (!USE_SUPABASE && entree.lignes) {
        entree.lignes.forEach((ligne) => {
          const produit = produits.find((p) => p.id === ligne.produitId);
          if (produit) {
            const prix = produit.prix_achat ?? produit.prixAchat ?? 0;
            entreeValue += ligne.quantite * prix;
            produitsCount += ligne.quantite || 0;
          }
        });
      } else if (USE_SUPABASE && entreesDetails[entree.id]) {
        entreesDetails[entree.id].forEach((ligne) => {
          const prix = parseFloat(ligne.prix_achat) || 0;
          const qteRecue = parseInt(ligne.qte_recue, 10) || 0;
          entreeValue += qteRecue * prix;
          produitsCount += qteRecue;
        });
      }

      totalValeurEntrees += entreeValue;
      totalProduitsReçus += produitsCount;

      const paye = Boolean(entree.paye);
      if (paye) {
        totalEntreesPayees++;
        totalValeurEntreesPayees += entreeValue;
      } else {
        totalEntreesNonPayees++;
        totalValeurEntreesNonPayees += entreeValue;
      }
    });

    // ========== PAIEMENTS ==========
    const totalPaiements = paiements.length;
    const totalMontantPaiements = paiements.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
    const moyennePaiement = totalPaiements > 0 ? totalMontantPaiements / totalPaiements : 0;

    // ========== DÉPENSES ==========
    const totalDepenses = depenses.length;
    const totalMontantDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0);
    const moyenneDepense = totalDepenses > 0 ? totalMontantDepenses / totalDepenses : 0;
    
    // Groupement par catégorie
    const depensesParCategorie = {};
    depenses.forEach(d => {
      const nom = d.depense_categories?.nom || d.nom || 'Sans catégorie';
      if (!depensesParCategorie[nom]) {
        depensesParCategorie[nom] = { count: 0, total: 0 };
      }
      depensesParCategorie[nom].count++;
      depensesParCategorie[nom].total += d.montant || 0;
    });
    const nombreCategories = Object.keys(depensesParCategorie).length;

    // ========== CALCULS FINANCIERS ==========
    const soldeGlobal = totalMontantPaiements - totalValeurEntreesNonPayees;
    const tauxPaiementEntrees = totalValeurEntrees > 0 ? (totalValeurEntreesPayees / totalValeurEntrees) * 100 : 0;
    const tauxEntreesPayees = totalEntrees > 0 ? (totalEntreesPayees / totalEntrees) * 100 : 0;

    // ========== DATES ==========
    const entreesRecent = entrees.slice(-5).reverse();
    const paiementsRecent = paiements.slice(-5).reverse();
    const depensesRecent = depenses.slice(-5).reverse();

    return {
      // Produits
      totalProduits,
      valeurTotaleProduits,
      prixMoyenProduits,
      produitsAvecReference,
      
      // Fournisseurs
      totalFournisseurs,
      
      // Entrées
      totalEntrees,
      totalValeurEntrees,
      totalValeurEntreesPayees,
      totalValeurEntreesNonPayees,
      totalEntreesPayees,
      totalEntreesNonPayees,
      totalProduitsReçus,
      
      // Paiements
      totalPaiements,
      totalMontantPaiements,
      moyennePaiement,
      
      // Dépenses
      totalDepenses,
      totalMontantDepenses,
      moyenneDepense,
      nombreCategories,
      depensesParCategorie,
      
      // Calculs financiers
      soldeGlobal,
      tauxPaiementEntrees,
      tauxEntreesPayees,
      
      // Récents
      entreesRecent,
      paiementsRecent,
      depensesRecent
    };
  }, [state, entreesDetails]);

  // Statistiques par période
  const periodStats = useMemo(() => {
    const entrees = state.entrees || [];
    const paiements = state.paiements || [];
    const depenses = state.depenses || [];
    
    const todayEntrees = filterByPeriod(entrees, 'date', 'today');
    const weekEntrees = filterByPeriod(entrees, 'date', 'week');
    const monthEntrees = filterByPeriod(entrees, 'date', 'month');
    
    const todayPaiements = filterByPeriod(paiements, 'date', 'today');
    const weekPaiements = filterByPeriod(paiements, 'date', 'week');
    const monthPaiements = filterByPeriod(paiements, 'date', 'month');
    
    const todayDepenses = filterByPeriod(depenses, 'date', 'today');
    const weekDepenses = filterByPeriod(depenses, 'date', 'week');
    const monthDepenses = filterByPeriod(depenses, 'date', 'month');
    
    const calcEntrees = (items) => ({
      count: items.length,
      payees: items.filter(e => e.paye).length,
      nonPayees: items.filter(e => !e.paye).length
    });
    
    const calcPaiements = (items) => ({
      count: items.length,
      total: items.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0),
    });
    
    const calcDepenses = (items) => ({
      count: items.length,
      total: items.reduce((sum, d) => sum + (d.montant || 0), 0),
    });
    
    return {
      today: {
        entrees: calcEntrees(todayEntrees),
        paiements: calcPaiements(todayPaiements),
        depenses: calcDepenses(todayDepenses)
      },
      week: {
        entrees: calcEntrees(weekEntrees),
        paiements: calcPaiements(weekPaiements),
        depenses: calcDepenses(weekDepenses)
      },
      month: {
        entrees: calcEntrees(monthEntrees),
        paiements: calcPaiements(monthPaiements),
        depenses: calcDepenses(monthDepenses)
      }
    };
  }, [state.entrees, state.paiements, state.depenses]);

  const periodColumns = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' },
  ];

  const categoriesSorted = Object.entries(allStats.depensesParCategorie).sort(
    (a, b) => b[1].total - a[1].total
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vue d'ensemble"
        title="Tableau de bord"
        description="Pilotage stock, fournisseurs, paiements et dépenses — Cosmos Algérie."
        actions={
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exporter les données
          </Button>
        }
      />

      {/* KPI prioritaires — admin */}
      {isAdmin() && (
        <Section title="Indicateurs clés" description="Valeurs consolidées (hors entrées en attente en mode Supabase).">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Valeur totale des entrées"
              value={formatDa(allStats.totalValeurEntrees)}
              hint={`${formatNum(allStats.totalProduitsReçus)} paires reçues`}
              icon={Package}
              tone="info"
            />
            <KpiTile
              label="Montant restant dû"
              value={formatDa(allStats.totalValeurEntreesNonPayees)}
              hint={`${formatNum(allStats.totalEntreesNonPayees)} entrées non payées`}
              icon={TrendingDown}
              tone="danger"
            />
            <KpiTile
              label="Paiements effectués"
              value={formatDa(allStats.totalMontantPaiements)}
              hint={`${formatNum(allStats.totalPaiements)} paiements`}
              icon={TrendingUp}
              tone="success"
            />
            <KpiTile
              label="Dépenses"
              value={formatDa(allStats.totalMontantDepenses)}
              hint={`${formatNum(allStats.totalDepenses)} enregistrements`}
              icon={ShoppingCart}
            />
          </div>

          {/* Secondaires compacts */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-card/50 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetaStat label="Produits" value={formatNum(allStats.totalProduits)} />
            <MetaStat label="Fournisseurs" value={formatNum(allStats.totalFournisseurs)} />
            <MetaStat label="Entrées" value={formatNum(allStats.totalEntrees)} />
            <MetaStat label="Qté reçues" value={formatNum(allStats.totalProduitsReçus)} />
            <MetaStat label="Taux paiement" value={`${allStats.tauxPaiementEntrees.toFixed(1)} %`} />
          </div>

          {/* Détails financiers — données préservées */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/60 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetaStat label="Entrées payées" value={formatNum(allStats.totalEntreesPayees)} tone="success" />
            <MetaStat label="Entrées non payées" value={formatNum(allStats.totalEntreesNonPayees)} tone="danger" />
            <MetaStat label="Valeur payée" value={formatDa(allStats.totalValeurEntreesPayees)} />
            <MetaStat label="Moy. paiement" value={formatDa(allStats.moyennePaiement)} />
            <MetaStat label="Moy. dépense" value={formatDa(allStats.moyenneDepense)} />
            <MetaStat
              label="Solde global"
              value={formatDa(allStats.soldeGlobal)}
              tone={allStats.soldeGlobal >= 0 ? 'success' : 'danger'}
            />
            <MetaStat label="Prix moyen produits" value={formatDa(allStats.prixMoyenProduits)} />
            <MetaStat label="Taux entrées payées" value={`${allStats.tauxEntreesPayees.toFixed(1)} %`} />
            <MetaStat label="Valeur catalogue" value={formatDa(allStats.valeurTotaleProduits)} />
            <MetaStat label="Avec référence" value={formatNum(allStats.produitsAvecReference)} />
            <MetaStat label="Catégories dépenses" value={formatNum(allStats.nombreCategories)} />
          </div>
        </Section>
      )}

      {/* Périodes — admin */}
      {isAdmin() && (
        <Section title="Activité récente" description="Comparaison aujourd'hui / semaine / mois.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {periodColumns.map(({ key, label }) => {
              const p = periodStats[key];
              return (
                <div key={key} className="rounded-lg border border-border/80 bg-card px-4 py-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Entrées</span>
                      <span className="font-medium tabular-nums">{p.entrees.count}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Paiements</span>
                      <span className="font-medium tabular-nums text-right">
                        {p.paiements.count}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({formatDa(p.paiements.total)})
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Dépenses</span>
                      <span className="font-medium tabular-nums text-right">
                        {p.depenses.count}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({formatDa(p.depenses.total)})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Produits aperçu */}
      <Section
        title="Produits"
        description={`${allStats.totalProduits} produit(s) · aperçu des 6 derniers`}
      >
        {(state.produits || []).length === 0 ? (
          <EmptyBlock message="Aucun produit enregistré" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nom</th>
                  <th className="px-3 py-2 font-medium">Référence</th>
                  <th className="px-3 py-2 text-right font-medium">Prix achat</th>
                </tr>
              </thead>
              <tbody>
                {(state.produits || []).slice(0, 6).map((produit) => (
                  <tr key={produit.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{produit.nom}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{produit.reference || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatDa(produit.prix_achat ?? produit.prixAchat ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Entrées récentes */}
        <Section title="Entrées récentes" description={`${allStats.totalEntrees} au total`}>
          {(state.entrees || []).length === 0 ? (
            <EmptyBlock message="Aucune entrée enregistrée" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    {isAdmin() && <th className="px-3 py-2 font-medium">Fournisseur</th>}
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allStats.entreesRecent.map((entree) => (
                    <tr key={entree.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 tabular-nums">{entree.date}</td>
                      {isAdmin() && (
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {getFournisseurName(entree)}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          status={entree.paye ? 'paye' : 'litige'}
                          label={entree.paye ? 'Payé' : 'Non payé'}
                        />
                        {!USE_SUPABASE && entree.lignes ? (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {entree.lignes.length} ligne(s)
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Paiements récents */}
        <Section title="Paiements récents" description={`${allStats.totalPaiements} au total`}>
          {(state.paiements || []).length === 0 ? (
            <EmptyBlock message="Aucun paiement enregistré" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    {isAdmin() && <th className="px-3 py-2 font-medium">Fournisseur</th>}
                    <th className="px-3 py-2 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {allStats.paiementsRecent.map((paiement) => (
                    <tr key={paiement.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 tabular-nums">{paiement.date}</td>
                      {isAdmin() && (
                        <td className="max-w-[160px] truncate px-3 py-2.5 text-muted-foreground">
                          {getFournisseurName(paiement.fournisseur_id ?? paiement.fournisseurId)}
                          {paiement.description ? (
                            <span className="block truncate text-[11px]">{paiement.description}</span>
                          ) : null}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-success">
                        {formatDa(paiement.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Dépenses + catégories */}
      <Section
        title="Dépenses"
        description={`${allStats.totalDepenses} dépense(s) · ${allStats.nombreCategories} catégorie(s)`}
      >
        {(state.depenses || []).length === 0 ? (
          <EmptyBlock message="Aucune dépense enregistrée" />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="overflow-x-auto rounded-lg border border-border/80 lg:col-span-3">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Catégorie</th>
                    <th className="px-3 py-2 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {allStats.depensesRecent.map((depense) => (
                    <tr key={depense.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 tabular-nums">{depense.date}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-muted-foreground">
                          {depense.depense_categories?.nom || depense.nom || '—'}
                        </span>
                        {depense.description ? (
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {depense.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {formatDa(depense.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border/80 bg-card px-4 py-3 lg:col-span-2">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Répartition par catégorie
              </p>
              {categoriesSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune catégorie</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {categoriesSorted.map(([nom, data]) => (
                    <li key={nom} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {nom}
                        <span className="ml-1 text-[11px]">×{data.count}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{formatDa(data.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
};

export default Dashboard;
