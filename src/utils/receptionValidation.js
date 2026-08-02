/**
 * Formules de réception — alignées sur EmployeeValidation.jsx / validateEntree.
 * Ne pas modifier le résultat métier ; centralisation présentation / UI uniquement.
 */

/** Quantité manquante d’une ligne (paires). */
export function calcManqueQte(qteEnvoyee, qteRecue) {
  return Math.max((parseInt(qteEnvoyee, 10) || 0) - (parseInt(qteRecue, 10) || 0), 0);
}

/**
 * Totaux comme EmployeeValidation (totals useMemo) :
 * envoye / recu / manque (DA) + manquePaires.
 */
export function calcReceptionTotals(lignes) {
  return (lignes || []).reduce(
    (acc, l) => {
      const qteEnvoyee = parseInt(l.qte_envoyee ?? l.quantite, 10) || 0;
      const qteRecue = parseInt(l.qteRecue ?? l.quantite_recue, 10) || 0;
      const prix = parseFloat(l.prix_achat) || 0;
      const manqueQte = calcManqueQte(qteEnvoyee, qteRecue);
      acc.envoye += qteEnvoyee * prix;
      acc.recu += qteRecue * prix;
      acc.manque += manqueQte * prix;
      acc.manquePaires += manqueQte;
      acc.qteEnvoyee += qteEnvoyee;
      acc.qteRecue += qteRecue;
      return acc;
    },
    { envoye: 0, recu: 0, manque: 0, manquePaires: 0, qteEnvoyee: 0, qteRecue: 0 }
  );
}

/** Statut final prévu — même règle que validateEntree / EmployeeValidation. */
export function calcStatutPrevu(totalsOrLignes) {
  const totals =
    totalsOrLignes && typeof totalsOrLignes.manquePaires === 'number'
      ? totalsOrLignes
      : calcReceptionTotals(totalsOrLignes);
  return totals.manquePaires > 0 ? 'litige' : 'valide';
}
