/**
 * Traduction des erreurs RPC / réseau acomptes en messages FR compréhensibles.
 * Aucune stack, URL, clé ou détail SQL exposé à l’utilisateur.
 */

const MIGRATION_MISSING =
  "La migration du journal des acomptes n'est pas encore installée.";

const NETWORK_UNAVAILABLE =
  'Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.';

function rawMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || String(error);
}

function logDevDetail(error) {
  if (typeof console === 'undefined' || typeof console.error !== 'function') return;
  const safe = {
    message: rawMessage(error),
    code: error?.code || error?.error_code || undefined,
    name: error?.name || undefined,
  };
  console.error('[acompte RPC]', safe);
}

export function isAcompteRpcMissingError(error) {
  const msg = rawMessage(error).toLowerCase();
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  if (code === 'pgrst202' || code === '42883') return true;
  if (msg.includes('could not find the function')) return true;
  if (msg.includes('function') && msg.includes('does not exist')) return true;
  if (msg.includes('schema cache') && msg.includes('function')) return true;
  if (msg.includes('rpc') && (msg.includes('not found') || msg.includes('inexist'))) return true;
  return false;
}

export function isAcompteNetworkError(error) {
  const msg = rawMessage(error).toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  if (name === 'typeerror' && msg.includes('failed to fetch')) return true;
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('networkerror') || msg.includes('network request failed')) return true;
  if (msg.includes('network error') || msg.includes('erreur de connexion')) return true;
  if (msg.includes('load failed') || msg.includes('fetch failed')) return true;
  if (msg.includes('econnrefused') || msg.includes('enotfound')) return true;
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) return true;
  if (msg.includes('abort') && msg.includes('timeout')) return true;
  if (codeIsNetwork(error)) return true;
  return false;
}

function codeIsNetwork(error) {
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  return ['econnrefused', 'enotfound', 'etimedout', 'econnreset', 'err_network'].includes(code);
}

export function translateAcompteRpcError(error) {
  if (isAcompteRpcMissingError(error)) {
    return MIGRATION_MISSING;
  }

  if (isAcompteNetworkError(error)) {
    return NETWORK_UNAVAILABLE;
  }

  const msg = rawMessage(error);
  if (!msg) {
    return 'Une erreur est survenue lors de l’opération sur l’acompte.';
  }

  const lower = msg.toLowerCase();

  // Mapping métier / SQL → FR stable
  if (lower.includes('permission refusée') || lower.includes('42501')) {
    if (lower.includes('restaur')) {
      return "Permission refusée : seule l'administration peut restaurer un acompte.";
    }
    if (lower.includes('journal')) {
      return "Permission refusée : journal réservé à l'administration.";
    }
    return msg.includes('Permission refusée')
      ? msg
      : 'Permission refusée pour cette opération sur les acomptes.';
  }

  if (lower.includes('mois est clôturé') || lower.includes('mois est cloture')) {
    return msg.includes('Ce mois est clôturé')
      ? msg
      : "Ce mois est clôturé. Annulez d'abord la clôture avant de continuer.";
  }

  if (
    lower.includes('motif') &&
    (lower.includes('obligatoire') || lower.includes('vide') || lower.includes('manquant'))
  ) {
    return 'Le motif de la suppression est obligatoire.';
  }

  if (lower.includes('introuvable') || (lower.includes('not found') && lower.includes('acompte'))) {
    return 'Acompte introuvable.';
  }
  if (lower.includes('acompte introuvable') || lower.includes('p0002')) {
    return 'Acompte introuvable.';
  }

  if (lower.includes('déjà supprimé') || lower.includes('deja supprime')) {
    return 'Cet acompte est déjà supprimé.';
  }

  if (lower.includes("n'est pas supprimé") || lower.includes('pas supprime')) {
    return "Cet acompte n'est pas supprimé.";
  }

  if (lower.includes('restaur') && (lower.includes('interdit') || lower.includes('refus'))) {
    return "Permission refusée : seule l'administration peut restaurer un acompte.";
  }

  if (lower.includes('rpc') && (lower.includes('indisponible') || lower.includes('unavailable'))) {
    return MIGRATION_MISSING;
  }

  // Messages métier déjà rédigés côté SQL — les renvoyer tels quels
  const passthrough = [
    'Ce mois est clôturé',
    'Permission refusée',
    'Le motif de la suppression est obligatoire',
    'Acompte introuvable',
    'déjà supprimé',
    "n'est pas supprimé",
    'Montant invalide',
    'Date invalide',
    'Salarié introuvable',
    'salary_id obligatoire',
    'Offset invalide',
    'Limit invalide',
    'Action de filtre invalide',
    'journal réservé',
  ];
  if (passthrough.some((p) => msg.includes(p))) {
    return msg;
  }

  // Éviter de renvoyer URL / clés / SQL brut
  if (
    lower.includes('supabase.co') ||
    lower.includes('eyj') ||
    lower.includes('apikey') ||
    lower.includes('stack') ||
    lower.includes('select ') ||
    lower.includes('insert ')
  ) {
    logDevDetail(error);
    return 'Une erreur est survenue lors de l’opération sur l’acompte.';
  }

  // Message déjà en français court : conserver ; sinon générique
  if (/[àâäéèêëïîôùûüç]/i.test(msg) || msg.length < 180) {
    return msg;
  }

  logDevDetail(error);
  return 'Une erreur est survenue lors de l’opération sur l’acompte.';
}

export { MIGRATION_MISSING, NETWORK_UNAVAILABLE };
