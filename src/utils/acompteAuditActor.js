/**
 * Acteur d'audit acomptes — dérivé de la session applicative (comptes).
 * Ne jamais demander le nom d'auteur à l'utilisateur.
 */

export function buildAcompteAuditActor(user) {
  if (!user) return null;
  return {
    account_id: user.id ?? null,
    username: user.username ?? null,
    name: user.name ?? null,
    role: user.role ?? null,
  };
}

export function assertCanMutateAcompte(actor) {
  if (!actor || (actor.role !== 'admin' && actor.role !== 'user')) {
    throw new Error(
      'Permission refusée : seuls admin et user peuvent gérer les acomptes.'
    );
  }
  return actor;
}

export function assertCanRestoreAcompte(actor) {
  if (!actor || actor.role !== 'admin') {
    throw new Error(
      "Permission refusée : seule l'administration peut restaurer un acompte."
    );
  }
  return actor;
}

export function canMutateAcompteRole(role) {
  return role === 'admin' || role === 'user';
}

export function canRestoreAcompteRole(role) {
  return role === 'admin';
}

export function canViewAcompteAuditLog(role) {
  return role === 'admin';
}
