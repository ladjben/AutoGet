-- =============================================================================
-- Verrouillage post-déploiement (étape 2/2) — HORS migrations automatiques
-- Fichier : sql/post-deploy/enforce-acompte-rpc-only.sql
-- =============================================================================
--
-- QUAND L'EXÉCUTER
--   UNIQUEMENT après :
--     1) apply réussi de 20260802120957_acompte_soft_delete_audit_expand.sql
--     2) déploiement réussi de la NOUVELLE application (RPC only) sur main
--     3) smoke tests acomptes OK sur la nouvelle app
--
-- NE PAS
--   - l'inclure dans supabase/migrations/ (évite apply auto / preview)
--   - l'exécuter tant que l'ancienne app main écrit encore en production
--   - l'exécuter pour « faire marcher » un preview (casse l'ancienne app)
--
-- EFFET
--   Révoque INSERT / UPDATE / DELETE directs sur public.acomptes pour
--   PUBLIC, anon, authenticated. Conserve SELECT. Les RPC SECURITY DEFINER
--   restent les seuls chemins de mutation clients.
--
-- NE PAS EXÉCUTER SANS AUTORISATION EXPLICITE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prérequis : les quatre RPC doivent exister (sinon ABORT)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'create_acompte',
    'soft_delete_acompte',
    'restore_acompte',
    'fetch_acompte_audit_logs'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
    ) THEN
      v_missing := array_append(v_missing, v_name);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORT verrouillage acomptes : RPC manquante(s) : %. Appliquer d''abord la migration expand.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  RAISE NOTICE 'Prérequis OK : les 4 RPC acomptes / audit sont présentes.';
END $$;

-- ---------------------------------------------------------------------------
-- 1. (Recommandé) Normaliser soft-deletes de transition sans motif
--    Puis poser le CHECK « motif obligatoire » — safe car seule la nouvelle
--    app (RPC) écrit encore après ce script.
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
      'Transition : % soft-delete(s) sans motif — backfill motif technique (pas d''auteur inventé).',
      v_legacy_count;

    UPDATE public.acomptes
    SET deletion_reason = 'Suppression antérieure à la mise en place du journal'
    WHERE deleted_at IS NOT NULL
      AND (
        deletion_reason IS NULL
        OR length(btrim(deletion_reason)) = 0
      );
  ELSE
    RAISE NOTICE 'Aucun soft-delete sans motif (OK).';
  END IF;
END $$;

ALTER TABLE public.acomptes
  DROP CONSTRAINT IF EXISTS acomptes_deletion_reason_when_deleted_chk;

ALTER TABLE public.acomptes
  ADD CONSTRAINT acomptes_deletion_reason_when_deleted_chk
  CHECK (
    deleted_at IS NULL
    OR (
      deletion_reason IS NOT NULL
      AND length(btrim(deletion_reason)) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Révoquer les mutations directes (cœur du verrouillage)
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON TABLE public.acomptes FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.acomptes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.acomptes FROM authenticated;

-- Lecture applicative (listes / totaux PostgREST)
GRANT SELECT ON TABLE public.acomptes TO anon;
GRANT SELECT ON TABLE public.acomptes TO authenticated;

-- =============================================================================
-- 3. Requêtes de vérification (à exécuter manuellement après apply)
-- =============================================================================
--
-- -- 3.1 RPC toujours présentes + EXECUTE client
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'create_acompte', 'soft_delete_acompte',
--     'restore_acompte', 'fetch_acompte_audit_logs'
--   )
-- ORDER BY p.proname;
--
-- -- 3.2 Mutations directes REFUSÉES ; SELECT conservé
-- SELECT has_table_privilege('anon', 'public.acomptes', 'SELECT') AS anon_sel,   -- true
--        has_table_privilege('anon', 'public.acomptes', 'INSERT') AS anon_ins,   -- false
--        has_table_privilege('anon', 'public.acomptes', 'UPDATE') AS anon_upd,   -- false
--        has_table_privilege('anon', 'public.acomptes', 'DELETE') AS anon_del;   -- false
--
-- SELECT has_table_privilege('authenticated', 'public.acomptes', 'SELECT') AS auth_sel,
--        has_table_privilege('authenticated', 'public.acomptes', 'INSERT') AS auth_ins,
--        has_table_privilege('authenticated', 'public.acomptes', 'UPDATE') AS auth_upd,
--        has_table_privilege('authenticated', 'public.acomptes', 'DELETE') AS auth_del;
--
-- -- 3.3 Grants table (aperçu)
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'acomptes'
-- ORDER BY grantee, privilege_type;
--
-- -- 3.4 Motif obligatoire respecté
-- SELECT count(*) AS soft_delete_sans_motif
-- FROM public.acomptes
-- WHERE deleted_at IS NOT NULL
--   AND (deletion_reason IS NULL OR length(btrim(deletion_reason)) = 0);
-- -- → 0
--
-- =============================================================================
-- 4. ROLLBACK TEMPORAIRE D'URGENCE (COMMENTÉ — ne pas exécuter par défaut)
-- =============================================================================
-- Réaccorde les anciens droits clients si retour arrière app / incident.
-- Ne supprime PAS les colonnes, RPC, trigger ni audit_logs.
-- ATTENTION : rouvre les mutations directes (contournement possible du journal).
--
-- -- BEGIN;
-- --
-- -- ALTER TABLE public.acomptes
-- --   DROP CONSTRAINT IF EXISTS acomptes_deletion_reason_when_deleted_chk;
-- --
-- -- GRANT INSERT, UPDATE, DELETE ON TABLE public.acomptes TO anon;
-- -- GRANT INSERT, UPDATE, DELETE ON TABLE public.acomptes TO authenticated;
-- -- GRANT SELECT ON TABLE public.acomptes TO anon;
-- -- GRANT SELECT ON TABLE public.acomptes TO authenticated;
-- --
-- -- -- Vérif rollback :
-- -- -- SELECT has_table_privilege('anon', 'public.acomptes', 'INSERT');  -- true
-- --
-- -- COMMIT;
--
-- =============================================================================
-- Fin verrouillage post-déploiement
-- =============================================================================
