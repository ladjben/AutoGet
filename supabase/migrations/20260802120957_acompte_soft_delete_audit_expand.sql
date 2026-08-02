-- =============================================================================
-- Migration d'EXTENSION (étape 1/2) — déploiement progressif
-- Fichier   : supabase/migrations/20260802120957_acompte_soft_delete_audit_expand.sql
-- Révision  : #4 — expand sans verrouillage des mutations directes sur acomptes
-- =============================================================================
--
-- OBJECTIF
--   Étendre le schéma + journal + RPC pour que la NOUVELLE application fonctionne,
--   SANS casser l'ANCIENNE application (main) qui écrit encore en INSERT/UPDATE
--   directs sur public.acomptes pendant la période de transition.
--
-- CETTE MIGRATION NE FAIT PAS
--   - REVOKE INSERT / UPDATE / DELETE sur public.acomptes
--   - Contrainte DB « motif obligatoire si deleted_at »
--     (l'app main ne renseigne que deleted_at ; motif imposé par soft_delete_acompte)
--
-- VERROUILLAGE (étape 2/2 — manuel, hors migrations auto)
--   Voir : sql/post-deploy/enforce-acompte-rpc-only.sql
--   À exécuter UNIQUEMENT après déploiement réussi de la nouvelle app sur main.
--
-- PRÉREQUIS
--   - Extension uuid-ossp (uuid_generate_v4) — déjà utilisée par le schéma live
--   - Tables public.acomptes, public.salary_history, public.salaries, public.comptes
--
-- DONNÉES EXISTANTES / STRATÉGIE LEGACY
--   1. Ajouter d'abord toutes les colonnes (nullable).
--   2. Détecter les lignes soft-supprimées sans motif :
--        deleted_at IS NOT NULL AND (deletion_reason IS NULL OR btrim(deletion_reason) = '')
--   3. Pour ces lignes UNIQUEMENT : renseigner deletion_reason avec la valeur technique
--        'Suppression antérieure à la mise en place du journal'
--      SANS inventer d'auteur (deleted_by_* restent NULL).
--   4. Les ~209 acomptes actifs (deleted_at NULL) ne sont PAS backfillés (created_by_* NULL).
--   5. Aucun log d'audit n'est généré pour le passé (pas de rejeu historique).
--   6. Pendant la transition, soft-deletes de l'ancienne app peuvent laisser
--      deletion_reason NULL ; le script post-deploy les normalisera avant le CHECK.
--
-- SÉCURITÉ (état après expand — transition)
--   - Identité acteur = session applicative (comptes) passée en paramètres RPC.
--   - Falsifiable tant que clé anon + pas de Supabase Auth / RLS.
--   - audit_logs : aucun SELECT/INSERT/UPDATE/DELETE direct pour PUBLIC/anon/authenticated.
--   - acomptes : droits clients INCHANGÉS (INSERT/UPDATE/DELETE encore possibles).
--   - Nouvelle app : mutations via create_acompte / soft_delete_acompte / restore_acompte.
--   - Ancienne app : INSERT/UPDATE directs toujours OK ; trigger journalise
--     (acteur souvent NULL si colonnes audit non renseignées).
--   - Lecture journal : uniquement via fetch_acompte_audit_logs.
--
-- COMPATIBILITÉ APPLICATIVE (après expand)
--   - Ancien addAcompte (INSERT direct) : CONTINUE de fonctionner.
--   - Ancien deleteAcompte (UPDATE deleted_at seul) : CONTINUE de fonctionner.
--   - Nouvelle app (RPC) : fonctionne en parallèle.
--   - Preview + main peuvent partager temporairement la même base.
--
-- ORDRE D'EXÉCUTION RECOMMANDÉ
--   1. Apply cette migration d'extension (staging puis prod contrôlée).
--   2. Déployer / tester la nouvelle app (preview puis main) — RPC only.
--   3. Confirmer smoke acomptes côté ancienne ET nouvelle app.
--   4. Exécuter sql/post-deploy/enforce-acompte-rpc-only.sql.
--
-- ROLLBACK NON DESTRUCTIF (expand)
--   1. DROP TRIGGER IF EXISTS trg_acomptes_audit ON public.acomptes;
--   2. REVOKE EXECUTE sur create/soft_delete/restore/fetch_* FROM clients ;
--   Colonnes et lignes audit_logs conservées.
--   (Les droits INSERT/UPDATE/DELETE acomptes n'ayant pas été retirés, rien à restaurer.)
--
-- NE PAS EXÉCUTER EN PRODUCTION SANS AUTORISATION EXPLICITE.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. COLONNES public.acomptes
-- =============================================================================

ALTER TABLE public.acomptes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.acomptes
  ADD COLUMN IF NOT EXISTS created_by_account_id UUID,
  ADD COLUMN IF NOT EXISTS created_by_username TEXT,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_account_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_username TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_role TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_by_account_id UUID,
  ADD COLUMN IF NOT EXISTS restored_by_username TEXT,
  ADD COLUMN IF NOT EXISTS restored_by_name TEXT,
  ADD COLUMN IF NOT EXISTS restored_by_role TEXT;

COMMENT ON COLUMN public.acomptes.deleted_at IS
  'Soft delete ; NULL = actif. Horodatage serveur via RPC now().';
COMMENT ON COLUMN public.acomptes.deletion_reason IS
  'Motif de soft delete. Legacy éventuel : « Suppression antérieure à la mise en place du journal ».';
COMMENT ON COLUMN public.acomptes.created_by_account_id IS
  'Auteur applicatif (comptes.id) ; NULL pour lignes historiques pré-journal.';

-- ---------------------------------------------------------------------------
-- 1.b Contrôle préalable legacy soft-delete sans motif (aucune invention d'auteur)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_legacy_count integer;
BEGIN
  SELECT count(*)::integer
  INTO v_legacy_count
  FROM public.acomptes
  WHERE deleted_at IS NOT NULL
    AND (
      deletion_reason IS NULL
      OR length(btrim(deletion_reason)) = 0
    );

  IF v_legacy_count > 0 THEN
    RAISE NOTICE
      'acomptes: % ligne(s) soft-supprimée(s) sans motif — backfill motif technique uniquement (pas d''auteur inventé).',
      v_legacy_count;

    UPDATE public.acomptes
    SET deletion_reason = 'Suppression antérieure à la mise en place du journal'
    WHERE deleted_at IS NOT NULL
      AND (
        deletion_reason IS NULL
        OR length(btrim(deletion_reason)) = 0
      );
    -- deleted_by_* volontairement inchangés (restent NULL).
  ELSE
    RAISE NOTICE 'acomptes: aucune ligne soft-supprimée sans motif (OK).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1.c Contraintes de rôles (paie : admin|user ; restauration : admin)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Remplacer d'éventuelles contraintes trop larges d'une version antérieure du fichier
  ALTER TABLE public.acomptes DROP CONSTRAINT IF EXISTS acomptes_created_by_role_chk;
  ALTER TABLE public.acomptes DROP CONSTRAINT IF EXISTS acomptes_deleted_by_role_chk;
  ALTER TABLE public.acomptes DROP CONSTRAINT IF EXISTS acomptes_restored_by_role_chk;
  ALTER TABLE public.acomptes DROP CONSTRAINT IF EXISTS acomptes_deletion_reason_when_deleted_chk;
  ALTER TABLE public.acomptes DROP CONSTRAINT IF EXISTS acomptes_deleted_fields_coherence_chk;

  ALTER TABLE public.acomptes
    ADD CONSTRAINT acomptes_created_by_role_chk
    CHECK (
      created_by_role IS NULL
      OR created_by_role IN ('admin', 'user')
    );

  ALTER TABLE public.acomptes
    ADD CONSTRAINT acomptes_deleted_by_role_chk
    CHECK (
      deleted_by_role IS NULL
      OR deleted_by_role IN ('admin', 'user')
    );

  ALTER TABLE public.acomptes
    ADD CONSTRAINT acomptes_restored_by_role_chk
    CHECK (
      restored_by_role IS NULL
      OR restored_by_role = 'admin'
    );

  -- INTENTIONNELLEMENT ABSENT ICI :
  -- acomptes_deletion_reason_when_deleted_chk
  -- L'app main fait UPDATE { deleted_at } sans motif. Motif imposé par soft_delete_acompte.
  -- Le CHECK + backfill transition seront appliqués dans
  -- sql/post-deploy/enforce-acompte-rpc-only.sql.

  -- États acceptés :
  --   A) actif jamais soft-supprimé :
  --        deleted_at NULL, restored_at NULL, deleted_* / motif NULL
  --   B) soft-supprimé :
  --        deleted_at NOT NULL (+ motif optionnel pendant transition)
  --   C) restauré :
  --        deleted_at NULL, restored_at NOT NULL ;
  --        deleted_by_* / deletion_reason peuvent être conservés
  ALTER TABLE public.acomptes
    ADD CONSTRAINT acomptes_deleted_fields_coherence_chk
    CHECK (
      (
        deleted_at IS NULL
        AND restored_at IS NULL
        AND deleted_by_account_id IS NULL
        AND deleted_by_username IS NULL
        AND deleted_by_name IS NULL
        AND deleted_by_role IS NULL
        AND deletion_reason IS NULL
      )
      OR deleted_at IS NOT NULL
      OR (
        deleted_at IS NULL
        AND restored_at IS NOT NULL
      )
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_acomptes_deleted_at ON public.acomptes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_acomptes_salary_id ON public.acomptes (salary_id);
CREATE INDEX IF NOT EXISTS idx_acomptes_created_at ON public.acomptes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acomptes_mois_annee ON public.acomptes (mois_annee);

-- =============================================================================
-- 2. TABLE public.audit_logs (append-only, pas d'accès table côté clients)
-- =============================================================================
-- Pas de séquence SERIAL : PK = uuid_generate_v4() → aucun GRANT SEQUENCE requis.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor_account_id UUID,
  actor_username TEXT,
  actor_name TEXT,
  actor_role TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_chk;
  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_role_chk;
  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_chk;

  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_action_chk
    CHECK (
      action IN ('acompte.created', 'acompte.deleted', 'acompte.restored')
    );

  -- Acteurs journal : mêmes règles métier paie
  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_role_chk
    CHECK (
      actor_role IS NULL
      OR actor_role IN ('admin', 'user')
    );

  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_entity_type_chk
    CHECK (entity_type = 'acompte');
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_account_id
  ON public.audit_logs (actor_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_username
  ON public.audit_logs (actor_username);

COMMENT ON TABLE public.audit_logs IS
  'Journal append-only. Aucun accès table pour anon/authenticated. Lecture via RPC admin uniquement. Écriture via trigger SECURITY DEFINER.';

-- Privilèges table : révocation totale pour clients (lecture/écriture).
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;
-- Pas de GRANT SELECT table : l'UI passe par fetch_acompte_audit_logs.
-- service_role : pas de GRANT table non plus (éviter contournement de la RPC).

-- =============================================================================
-- 3. HELPERS + TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.acompte_audit_row_snapshot(p_row public.acomptes)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'salary_id', p_row.salary_id,
    'montant', p_row.montant,
    'date', p_row.date,
    'mois_annee', p_row.mois_annee,
    'description', p_row.description,
    'deleted_at', p_row.deleted_at,
    'deletion_reason', p_row.deletion_reason,
    'created_by_account_id', p_row.created_by_account_id,
    'created_by_username', p_row.created_by_username,
    'created_by_name', p_row.created_by_name,
    'created_by_role', p_row.created_by_role,
    'deleted_by_account_id', p_row.deleted_by_account_id,
    'deleted_by_username', p_row.deleted_by_username,
    'deleted_by_name', p_row.deleted_by_name,
    'deleted_by_role', p_row.deleted_by_role,
    'restored_at', p_row.restored_at,
    'restored_by_account_id', p_row.restored_by_account_id,
    'restored_by_username', p_row.restored_by_username,
    'restored_by_name', p_row.restored_by_name,
    'restored_by_role', p_row.restored_by_role
  );
$$;

-- Interne : pas d'exécution client
REVOKE ALL ON FUNCTION public.acompte_audit_row_snapshot(public.acomptes) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acompte_audit_row_snapshot(public.acomptes) FROM anon;
REVOKE ALL ON FUNCTION public.acompte_audit_row_snapshot(public.acomptes) FROM authenticated;

CREATE OR REPLACE FUNCTION public.trg_fn_acomptes_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text;
  v_actor_account_id uuid;
  v_actor_username text;
  v_actor_name text;
  v_actor_role text;
  v_before jsonb;
  v_after jsonb;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'acompte.created';
    v_actor_account_id := NEW.created_by_account_id;
    v_actor_username := NEW.created_by_username;
    v_actor_name := NEW.created_by_name;
    v_actor_role := NEW.created_by_role;
    v_before := NULL;
    v_after := public.acompte_audit_row_snapshot(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'acompte.deleted';
      v_actor_account_id := NEW.deleted_by_account_id;
      v_actor_username := NEW.deleted_by_username;
      v_actor_name := NEW.deleted_by_name;
      v_actor_role := NEW.deleted_by_role;
      v_before := public.acompte_audit_row_snapshot(OLD);
      v_after := public.acompte_audit_row_snapshot(NEW);
      v_metadata := jsonb_build_object(
        'deletion_reason', NEW.deletion_reason,
        'mois_annee', COALESCE(
          NULLIF(btrim(COALESCE(NEW.mois_annee, '')), ''),
          to_char(NEW.date, 'YYYY-MM')
        )
      );

    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'acompte.restored';
      v_actor_account_id := NEW.restored_by_account_id;
      v_actor_username := NEW.restored_by_username;
      v_actor_name := NEW.restored_by_name;
      v_actor_role := NEW.restored_by_role;
      v_before := public.acompte_audit_row_snapshot(OLD);
      v_after := public.acompte_audit_row_snapshot(NEW);
      v_metadata := jsonb_build_object(
        'previous_deletion_reason', OLD.deletion_reason,
        'mois_annee', COALESCE(
          NULLIF(btrim(COALESCE(NEW.mois_annee, '')), ''),
          to_char(NEW.date, 'YYYY-MM')
        )
      );

    ELSE
      -- deleted_at inchangé (ou autre update) → aucun log
      RETURN NEW;
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_logs (
    entity_type,
    entity_id,
    action,
    actor_account_id,
    actor_username,
    actor_name,
    actor_role,
    before_data,
    after_data,
    metadata,
    created_at
  ) VALUES (
    'acompte',
    NEW.id,
    v_action,
    v_actor_account_id,
    v_actor_username,
    v_actor_name,
    v_actor_role,
    v_before,
    v_after,
    v_metadata,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_fn_acomptes_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_fn_acomptes_audit() FROM anon;
REVOKE ALL ON FUNCTION public.trg_fn_acomptes_audit() FROM authenticated;

DROP TRIGGER IF EXISTS trg_acomptes_audit ON public.acomptes;
CREATE TRIGGER trg_acomptes_audit
  AFTER INSERT OR UPDATE ON public.acomptes
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_fn_acomptes_audit();

-- =============================================================================
-- 4. RPC create_acompte (admin|user)
-- =============================================================================
-- Montant « valide » selon règles actuelles de l'app :
--   - NOT NULL, différent de 0 ;
--   - signé autorisé (acomptes / bonus > 0 ; retard / absence < 0 via actions rapides).
--   Pas de contrainte DB historique « > 0 » ; on refuse seulement 0 et NULL.

CREATE OR REPLACE FUNCTION public.create_acompte(
  p_salary_id uuid,
  p_montant numeric,
  p_date date,
  p_description text,
  p_actor_account_id uuid,
  p_actor_username text,
  p_actor_name text,
  p_actor_role text
)
RETURNS public.acomptes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.acomptes;
  v_mois text;
BEGIN
  IF p_actor_role IS NULL OR p_actor_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Permission refusée : seuls admin et user peuvent créer un acompte.'
      USING ERRCODE = '42501';
  END IF;

  IF p_salary_id IS NULL THEN
    RAISE EXCEPTION 'salary_id obligatoire.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.salaries AS s WHERE s.id = p_salary_id
  ) THEN
    RAISE EXCEPTION 'Salarié introuvable.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Règles actuelles : montant renseigné et non nul (signé autorisé).
  IF p_montant IS NULL OR p_montant = 0 THEN
    RAISE EXCEPTION 'Montant invalide : doit être non nul et différent de zéro.'
      USING ERRCODE = '22023';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Date invalide : la date est obligatoire.'
      USING ERRCODE = '22023';
  END IF;

  v_mois := to_char(p_date, 'YYYY-MM');

  IF EXISTS (
    SELECT 1
    FROM public.salary_history AS sh
    WHERE sh.mois_annee = v_mois
  ) THEN
    RAISE EXCEPTION 'Ce mois est clôturé. Annulez d''abord la clôture avant d''ajouter un acompte.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.acomptes (
    salary_id,
    montant,
    date,
    description,
    mois_annee,
    created_at,
    created_by_account_id,
    created_by_username,
    created_by_name,
    created_by_role
  ) VALUES (
    p_salary_id,
    p_montant,
    p_date,
    COALESCE(p_description, ''),
    v_mois,
    now(),
    p_actor_account_id,
    NULLIF(btrim(COALESCE(p_actor_username, '')), ''),
    NULLIF(btrim(COALESCE(p_actor_name, '')), ''),
    p_actor_role
  )
  RETURNING * INTO v_row;

  -- Trigger : exactement 1 log acompte.created.
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.create_acompte(uuid, numeric, date, text, uuid, text, text, text) IS
  'Création atomique d''un acompte (admin|user). mois_annee serveur. Refuse mois clôturé. Log via trigger.';

REVOKE ALL ON FUNCTION public.create_acompte(uuid, numeric, date, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_acompte(uuid, numeric, date, text, uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_acompte(uuid, numeric, date, text, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_acompte(uuid, numeric, date, text, uuid, text, text, text) TO service_role;

-- =============================================================================
-- 5. RPC soft_delete_acompte (admin|user)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_acompte(
  p_acompte_id uuid,
  p_actor_account_id uuid,
  p_actor_username text,
  p_actor_name text,
  p_actor_role text,
  p_reason text
)
RETURNS public.acomptes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.acomptes;
  v_mois text;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF p_actor_role IS NULL OR p_actor_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Permission refusée : seuls admin et user peuvent supprimer un acompte.'
      USING ERRCODE = '42501';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Le motif de la suppression est obligatoire.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_row
  FROM public.acomptes
  WHERE id = p_acompte_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acompte introuvable.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cet acompte est déjà supprimé.'
      USING ERRCODE = 'P0001';
  END IF;

  v_mois := COALESCE(
    NULLIF(btrim(COALESCE(v_row.mois_annee, '')), ''),
    to_char(v_row.date, 'YYYY-MM')
  );

  IF EXISTS (
    SELECT 1
    FROM public.salary_history AS sh
    WHERE sh.mois_annee = v_mois
  ) THEN
    RAISE EXCEPTION 'Ce mois est clôturé. Annulez d''abord la clôture avant de supprimer cet acompte.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.acomptes
  SET
    deleted_at = now(),
    deleted_by_account_id = p_actor_account_id,
    deleted_by_username = NULLIF(btrim(COALESCE(p_actor_username, '')), ''),
    deleted_by_name = NULLIF(btrim(COALESCE(p_actor_name, '')), ''),
    deleted_by_role = p_actor_role,
    deletion_reason = v_reason
  WHERE id = p_acompte_id
  RETURNING * INTO v_row;

  -- Trigger : exactement 1 log acompte.deleted. Rejeu → échec « déjà supprimé », 0 log.
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_acompte(uuid, uuid, text, text, text, text) IS
  'Soft delete atomique (admin|user). Motif obligatoire. Refuse mois clôturé. Log via trigger.';

REVOKE ALL ON FUNCTION public.soft_delete_acompte(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_acompte(uuid, uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_acompte(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_acompte(uuid, uuid, text, text, text, text) TO service_role;

-- =============================================================================
-- 6. RPC restore_acompte (admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_acompte(
  p_acompte_id uuid,
  p_actor_account_id uuid,
  p_actor_username text,
  p_actor_name text,
  p_actor_role text
)
RETURNS public.acomptes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.acomptes;
  v_mois text;
BEGIN
  IF p_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission refusée : seule l''administration peut restaurer un acompte.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_row
  FROM public.acomptes
  WHERE id = p_acompte_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acompte introuvable.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Cet acompte n''est pas supprimé.'
      USING ERRCODE = 'P0001';
  END IF;

  v_mois := COALESCE(
    NULLIF(btrim(COALESCE(v_row.mois_annee, '')), ''),
    to_char(v_row.date, 'YYYY-MM')
  );

  IF EXISTS (
    SELECT 1
    FROM public.salary_history AS sh
    WHERE sh.mois_annee = v_mois
  ) THEN
    RAISE EXCEPTION 'Ce mois est clôturé. Annulez d''abord la clôture avant de restaurer cet acompte.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Conserve deleted_by_* + deletion_reason (historique).
  UPDATE public.acomptes
  SET
    deleted_at = NULL,
    restored_at = now(),
    restored_by_account_id = p_actor_account_id,
    restored_by_username = NULLIF(btrim(COALESCE(p_actor_username, '')), ''),
    restored_by_name = NULLIF(btrim(COALESCE(p_actor_name, '')), ''),
    restored_by_role = 'admin'
  WHERE id = p_acompte_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.restore_acompte(uuid, uuid, text, text, text) IS
  'Restauration admin. Conserve motif/auteur de suppression. Refuse mois clôturé.';

REVOKE ALL ON FUNCTION public.restore_acompte(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_acompte(uuid, uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.restore_acompte(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_acompte(uuid, uuid, text, text, text) TO service_role;

-- =============================================================================
-- 7. RPC fetch_acompte_audit_logs (admin déclaré)
-- =============================================================================
-- SÉCURITÉ : p_caller_role est un paramètre applicatif FALSIFIABLE sans Supabase Auth.
-- Borne : limit 1..100 ; offset >= 0 (sinon erreur) ; dates inclusives [from, to].
-- DROP préalable : le type de retour a changé (plus de JSON brut) — OR REPLACE ne suffit pas.

DROP FUNCTION IF EXISTS public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean);

CREATE OR REPLACE FUNCTION public.fetch_acompte_audit_logs(
  p_caller_role text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_action text DEFAULT NULL,
  p_actor_username text DEFAULT NULL,
  p_salary_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_deleted_only boolean DEFAULT false
)
RETURNS TABLE (
  log_id uuid,
  log_created_at timestamptz,
  action text,
  actor_account_id uuid,
  actor_username text,
  actor_name text,
  actor_role text,
  entity_id uuid,
  acompte_id uuid,
  salary_id uuid,
  salary_nom text,
  montant numeric,
  acompte_date date,
  mois_annee text,
  description text,
  deletion_reason text,
  acompte_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_offset integer;
BEGIN
  IF p_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission refusée : journal réservé à l''administration.'
      USING ERRCODE = '42501';
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Offset invalide (doit être >= 0).'
      USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'Limit invalide (doit être >= 1).'
      USING ERRCODE = '22023';
  END IF;

  v_limit := LEAST(p_limit, 100);
  v_offset := p_offset;

  IF p_action IS NOT NULL AND p_action NOT IN (
    'acompte.created', 'acompte.deleted', 'acompte.restored'
  ) THEN
    RAISE EXCEPTION 'Action de filtre invalide.'
      USING ERRCODE = '22023';
  END IF;

  -- Champs UI uniquement (pas de before_data / after_data / metadata bruts).
  RETURN QUERY
  SELECT
    l.id AS log_id,
    l.created_at AS log_created_at,
    l.action,
    l.actor_account_id,
    l.actor_username,
    l.actor_name,
    l.actor_role,
    l.entity_id,
    a.id AS acompte_id,
    COALESCE(
      a.salary_id,
      NULLIF(l.after_data ->> 'salary_id', '')::uuid,
      NULLIF(l.before_data ->> 'salary_id', '')::uuid
    ) AS salary_id,
    s.nom AS salary_nom,
    COALESCE(
      a.montant,
      NULLIF(l.after_data ->> 'montant', '')::numeric,
      NULLIF(l.before_data ->> 'montant', '')::numeric
    ) AS montant,
    COALESCE(
      a.date,
      NULLIF(l.after_data ->> 'date', '')::date,
      NULLIF(l.before_data ->> 'date', '')::date
    ) AS acompte_date,
    COALESCE(
      a.mois_annee,
      l.after_data ->> 'mois_annee',
      l.before_data ->> 'mois_annee'
    ) AS mois_annee,
    COALESCE(
      a.description,
      l.after_data ->> 'description',
      l.before_data ->> 'description'
    ) AS description,
    COALESCE(
      a.deletion_reason,
      l.metadata ->> 'deletion_reason',
      l.after_data ->> 'deletion_reason'
    ) AS deletion_reason,
    CASE
      WHEN a.id IS NULL THEN 'inconnu'
      WHEN a.deleted_at IS NOT NULL THEN 'supprimé'
      WHEN a.restored_at IS NOT NULL THEN 'restauré'
      ELSE 'actif'
    END AS acompte_status
  FROM public.audit_logs AS l
  LEFT JOIN public.acomptes AS a ON a.id = l.entity_id
  LEFT JOIN public.salaries AS s ON s.id = COALESCE(
    a.salary_id,
    NULLIF(l.after_data ->> 'salary_id', '')::uuid,
    NULLIF(l.before_data ->> 'salary_id', '')::uuid
  )
  WHERE l.entity_type = 'acompte'
    AND (p_action IS NULL OR l.action = p_action)
    AND (
      p_actor_username IS NULL
      OR btrim(p_actor_username) = ''
      OR l.actor_username ILIKE '%' || btrim(p_actor_username) || '%'
    )
    AND (
      p_salary_id IS NULL
      OR a.salary_id = p_salary_id
      OR NULLIF(l.after_data ->> 'salary_id', '')::uuid = p_salary_id
      OR NULLIF(l.before_data ->> 'salary_id', '')::uuid = p_salary_id
    )
    -- Période inclusive : [p_date_from, p_date_to]
    AND (p_date_from IS NULL OR l.created_at >= p_date_from)
    AND (p_date_to IS NULL OR l.created_at <= p_date_to)
    AND (
      NOT COALESCE(p_deleted_only, false)
      OR a.deleted_at IS NOT NULL
      OR l.action = 'acompte.deleted'
    )
  ORDER BY l.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean) IS
  'Lecture paginée journal acomptes. p_caller_role=admin requis mais FALSIFIABLE sans Supabase Auth. Pas de JSON brut exposé.';

REVOKE ALL ON FUNCTION public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_acompte_audit_logs(text, integer, integer, text, text, uuid, timestamptz, timestamptz, boolean) TO service_role;

-- =============================================================================
-- 8. MUTATIONS DIRECTES SUR public.acomptes — CONSERVÉES (transition)
-- =============================================================================
-- NE PAS révoquer INSERT / UPDATE / DELETE ici.
-- L'ancienne application main dépend de :
--   INSERT → addAcompte
--   UPDATE { deleted_at } → deleteAcompte
-- Les RPC SECURITY DEFINER coexistent ; le trigger journalise aussi les écritures
-- directes (acteur NULL si colonnes audit non renseignées).
--
-- Verrouillage : sql/post-deploy/enforce-acompte-rpc-only.sql
--
-- Lecture applicative actuelle (PostgREST SELECT) — inchangée / explicite
GRANT SELECT ON TABLE public.acomptes TO anon;
GRANT SELECT ON TABLE public.acomptes TO authenticated;

-- =============================================================================
-- 9. MATRICE DES PRIVILÈGES APRÈS EXPAND (état de transition)
-- =============================================================================
--
-- TABLE public.acomptes
--   | Privilège | PUBLIC | anon | authenticated | owner / SECURITY DEFINER |
--   | SELECT    | (n/a)  | OUI  | OUI           | OUI                      |
--   | INSERT    | OUI*   | OUI* | OUI*          | OUI (aussi via create_acompte) |
--   | UPDATE    | OUI*   | OUI* | OUI*          | OUI (aussi soft_delete/restore)|
--   | DELETE    | OUI*   | OUI* | OUI*          | (à éviter métier)        |
--   * = droits clients inchangés par rapport au schéma live pré-migration.
--
-- TABLE public.audit_logs
--   PUBLIC / anon / authenticated : ALL révoqué
--   Écriture : trg_fn_acomptes_audit (SECURITY DEFINER)
--   Lecture app : fetch_acompte_audit_logs uniquement
--
-- RPC EXECUTE (PUBLIC révoqué ; GRANT à anon / authenticated / service_role)
--   create_acompte / soft_delete_acompte / restore_acompte / fetch_acompte_audit_logs
--
-- Chemins d'écriture pendant la transition :
--   A) Ancienne app : INSERT/UPDATE directs → trigger → audit_logs (acteur souvent NULL)
--   B) Nouvelle app : RPC → INSERT/UPDATE acomptes → trigger → audit_logs (acteur renseigné)
--
-- Après sql/post-deploy/enforce-acompte-rpc-only.sql : uniquement le chemin B.
--
-- =============================================================================
-- 10. VÉRIFICATIONS POST-EXPAND (manuel — non exécutées ici)
-- =============================================================================
--
-- -- Soft-deletes legacy sans motif restants (hors transition future) :
-- SELECT count(*) FILTER (
--   WHERE deleted_at IS NOT NULL
--     AND (deletion_reason IS NULL OR length(btrim(deletion_reason)) = 0)
-- ) FROM public.acomptes;  -- 0 juste après expand (backfill appliqué)
--
-- -- RPC présentes :
-- SELECT p.proname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'create_acompte', 'soft_delete_acompte', 'restore_acompte', 'fetch_acompte_audit_logs'
--   );
--
-- -- Mutations directes ENCORE autorisées (attendu en transition) :
-- SELECT has_table_privilege('anon', 'public.acomptes', 'INSERT') AS anon_ins,
--        has_table_privilege('anon', 'public.acomptes', 'UPDATE') AS anon_upd,
--        has_table_privilege('anon', 'public.acomptes', 'DELETE') AS anon_del;
-- -- → true / true / true (ou selon grants live préexistants)
--
-- -- audit_logs inaccessible en table :
-- SELECT has_table_privilege('anon', 'public.audit_logs', 'SELECT') AS anon_audit_sel;
-- -- → false
--
-- =============================================================================
-- Fin migration expand (révision #4) — pas de verrouillage acomptes
-- =============================================================================
