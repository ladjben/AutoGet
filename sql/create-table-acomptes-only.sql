-- ============================================
-- TABLE ACOMPTES UNIQUEMENT
-- ============================================
-- Script SQL pour créer la table acomptes dans Supabase
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Vérifier si la table salaries existe (requis pour la clé étrangère)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'salaries'
    ) THEN
        RAISE EXCEPTION 'La table salaries doit exister avant de créer acomptes. Exécutez d''abord create-table-salaries.sql';
    END IF;
END $$;

-- Table des acomptes
CREATE TABLE IF NOT EXISTS acomptes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salary_id UUID REFERENCES salaries(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_acomptes_salary_id ON acomptes(salary_id);
CREATE INDEX IF NOT EXISTS idx_acomptes_date ON acomptes(date);

-- Ajouter la colonne mois_annee si elle n'existe pas (pour le filtrage mensuel)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'acomptes' AND column_name = 'mois_annee'
    ) THEN
        ALTER TABLE acomptes ADD COLUMN mois_annee TEXT;
        -- Mettre à jour les acomptes existants avec le mois_annee basé sur la date
        UPDATE acomptes SET mois_annee = TO_CHAR(date, 'YYYY-MM') WHERE mois_annee IS NULL;
        -- Créer un index
        CREATE INDEX IF NOT EXISTS idx_acomptes_mois_annee ON acomptes(mois_annee);
    END IF;
END $$;

-- Désactiver RLS pour développement
ALTER TABLE acomptes DISABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE acomptes IS 'Acomptes versés aux salariés';
COMMENT ON COLUMN acomptes.salary_id IS 'Référence vers le salarié';
COMMENT ON COLUMN acomptes.montant IS 'Montant de l''acompte en DA';
COMMENT ON COLUMN acomptes.date IS 'Date de l''acompte';
COMMENT ON COLUMN acomptes.mois_annee IS 'Mois et année au format YYYY-MM (ex: 2024-01)';

