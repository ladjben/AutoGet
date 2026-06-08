-- ============================================
-- MIGRATION : Accès fournisseur / employé
-- ============================================
-- Étend les rôles comptes, lie fournisseurs aux comptes,
-- ajoute validation des entrées, notifications et vues dashboard.
-- Script idempotent — peut être exécuté plusieurs fois sans erreur.

-- ---------------------------------------------------------------------------
-- 1. Rôles comptes : admin, user, fournisseur, employe
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.comptes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE comptes DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE comptes
  ADD CONSTRAINT comptes_role_check
  CHECK (role IN ('admin', 'user', 'fournisseur', 'employe'));

COMMENT ON COLUMN comptes.role IS
  'Rôle : admin, user, fournisseur ou employe';

-- ---------------------------------------------------------------------------
-- 2. Lien compte ↔ fournisseur
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comptes'
      AND column_name = 'fournisseur_id'
  ) THEN
    ALTER TABLE comptes ADD COLUMN fournisseur_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comptes_fournisseur_id_fkey'
      AND conrelid = 'public.comptes'::regclass
  ) THEN
    ALTER TABLE comptes
      ADD CONSTRAINT comptes_fournisseur_id_fkey
      FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comptes_fournisseur_id ON comptes(fournisseur_id);

COMMENT ON COLUMN comptes.fournisseur_id IS
  'Fournisseur associé au compte (rôle fournisseur uniquement)';

-- ---------------------------------------------------------------------------
-- 3. Table produit_fournisseur (catalogue par fournisseur)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produit_fournisseur (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (produit_id, fournisseur_id)
);

CREATE INDEX IF NOT EXISTS idx_produit_fournisseur_produit_id
  ON produit_fournisseur(produit_id);
CREATE INDEX IF NOT EXISTS idx_produit_fournisseur_fournisseur_id
  ON produit_fournisseur(fournisseur_id);

COMMENT ON TABLE produit_fournisseur IS
  'Association produits ↔ fournisseurs autorisés';

-- ---------------------------------------------------------------------------
-- 4. Colonnes validation sur entrees
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entrees'
      AND column_name = 'statut'
  ) THEN
    ALTER TABLE entrees
      ADD COLUMN statut TEXT NOT NULL DEFAULT 'en_attente';
  END IF;
END $$;

ALTER TABLE entrees ALTER COLUMN statut SET DEFAULT 'en_attente';

UPDATE entrees SET statut = 'en_attente' WHERE statut IS NULL;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.entrees'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%statut%'
  LOOP
    EXECUTE format('ALTER TABLE entrees DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE entrees
  ADD CONSTRAINT entrees_statut_check
  CHECK (statut IN ('en_attente', 'valide', 'litige'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entrees'
      AND column_name = 'validated_at'
  ) THEN
    ALTER TABLE entrees ADD COLUMN validated_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entrees'
      AND column_name = 'validated_by'
  ) THEN
    ALTER TABLE entrees ADD COLUMN validated_by UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entrees'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE entrees ADD COLUMN created_by UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entrees_validated_by_fkey'
      AND conrelid = 'public.entrees'::regclass
  ) THEN
    ALTER TABLE entrees
      ADD CONSTRAINT entrees_validated_by_fkey
      FOREIGN KEY (validated_by) REFERENCES comptes(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entrees_created_by_fkey'
      AND conrelid = 'public.entrees'::regclass
  ) THEN
    ALTER TABLE entrees
      ADD CONSTRAINT entrees_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES comptes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entrees_statut ON entrees(statut);
CREATE INDEX IF NOT EXISTS idx_entrees_validated_by ON entrees(validated_by);
CREATE INDEX IF NOT EXISTS idx_entrees_created_by ON entrees(created_by);

COMMENT ON COLUMN entrees.statut IS 'en_attente, valide ou litige';
COMMENT ON COLUMN entrees.validated_at IS 'Date de validation de l''entrée';
COMMENT ON COLUMN entrees.validated_by IS 'Compte ayant validé l''entrée';
COMMENT ON COLUMN entrees.created_by IS 'Compte ayant créé l''entrée';

-- ---------------------------------------------------------------------------
-- 5. quantite_recue sur entree_lignes
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entree_lignes'
      AND column_name = 'quantite_recue'
  ) THEN
    ALTER TABLE entree_lignes ADD COLUMN quantite_recue INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN entree_lignes.quantite_recue IS
  'Quantité réellement reçue (saisie à la validation)';

-- ---------------------------------------------------------------------------
-- 6. Table notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  entree_id UUID REFERENCES entrees(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT,
  montant_manque DECIMAL(10, 2),
  paires_manquantes INTEGER,
  lu BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_fournisseur_id
  ON notifications(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_notifications_entree_id
  ON notifications(entree_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lu
  ON notifications(lu);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS
  'Notifications fournisseur (litiges, écarts de réception, etc.)';

-- ---------------------------------------------------------------------------
-- 7. Vue v_entree_lignes_detail
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_fournisseur_dashboard;
DROP VIEW IF EXISTS v_entree_lignes_detail;

CREATE VIEW v_entree_lignes_detail AS
SELECT
  el.id AS ligne_id,
  el.entree_id,
  e.fournisseur_id,
  e.date AS entree_date,
  e.statut,
  el.produit_id,
  el.variante_id,
  COALESCE(p.id, vp.id) AS produit_resolu_id,
  COALESCE(p.nom, vp.nom) AS produit_nom,
  COALESCE(p.prix_achat, vp.prix_achat, 0) AS prix_achat,
  el.quantite AS qte_envoyee,
  el.quantite_recue AS qte_recue,
  CASE
    WHEN e.statut = 'valide'
      THEN GREATEST(el.quantite - COALESCE(el.quantite_recue, 0), 0)
    ELSE 0
  END AS qte_manquante,
  el.quantite * COALESCE(p.prix_achat, vp.prix_achat, 0) AS valeur_envoyee,
  COALESCE(el.quantite_recue, 0) * COALESCE(p.prix_achat, vp.prix_achat, 0) AS valeur_recue,
  CASE
    WHEN e.statut = 'valide'
      THEN GREATEST(el.quantite - COALESCE(el.quantite_recue, 0), 0)
           * COALESCE(p.prix_achat, vp.prix_achat, 0)
    ELSE 0
  END AS valeur_manquante
FROM entree_lignes el
JOIN entrees e ON e.id = el.entree_id
LEFT JOIN produits p ON p.id = el.produit_id
LEFT JOIN variantes v ON v.id = el.variante_id
LEFT JOIN produits vp ON vp.id = v.produit_id;

COMMENT ON VIEW v_entree_lignes_detail IS
  'Détail lignes d''entrée avec quantités et valeurs envoyées / reçues / manquantes';

-- ---------------------------------------------------------------------------
-- 8. Vue v_fournisseur_dashboard
-- ---------------------------------------------------------------------------
CREATE VIEW v_fournisseur_dashboard AS
SELECT
  f.id AS fournisseur_id,
  f.nom AS fournisseur_nom,
  COALESCE(SUM(d.qte_envoyee), 0)::BIGINT AS paires_envoyees,
  COALESCE(SUM(
    CASE WHEN d.statut = 'valide' THEN COALESCE(d.qte_recue, 0) ELSE 0 END
  ), 0)::BIGINT AS paires_recues,
  COALESCE(SUM(d.qte_manquante), 0)::BIGINT AS paires_manquantes,
  COALESCE(SUM(
    CASE WHEN d.statut = 'valide' THEN d.valeur_recue ELSE 0 END
  ), 0) AS valeur_recue,
  COALESCE(SUM(d.valeur_manquante), 0) AS valeur_manquante,
  COALESCE(pay.total_paye, 0) AS total_paye,
  COALESCE(SUM(
    CASE WHEN d.statut = 'valide' THEN d.valeur_recue ELSE 0 END
  ), 0) - COALESCE(pay.total_paye, 0) AS montant_du
FROM fournisseurs f
LEFT JOIN v_entree_lignes_detail d ON d.fournisseur_id = f.id
LEFT JOIN (
  SELECT fournisseur_id, SUM(montant) AS total_paye
  FROM paiements
  GROUP BY fournisseur_id
) pay ON pay.fournisseur_id = f.id
GROUP BY f.id, f.nom, pay.total_paye;

COMMENT ON VIEW v_fournisseur_dashboard IS
  'Agrégats fournisseur : paires, valeurs, paiements et montant dû';

-- ---------------------------------------------------------------------------
-- RLS (désactivé pour cohérence avec le reste du schéma dev)
-- ---------------------------------------------------------------------------
ALTER TABLE produit_fournisseur DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
