-- ============================================
-- SCRIPT COMPLET POUR TABLES SALAIRES
-- ============================================
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- Ce script crée toutes les tables nécessaires pour la gestion des salaires

-- ============================================
-- 1. TABLE SALARIES (si elle n'existe pas)
-- ============================================
CREATE TABLE IF NOT EXISTS salaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  salaire_mensuel DECIMAL(10, 2) NOT NULL,
  contact TEXT,
  poste TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- 2. TABLE ACOMPTES (si elle n'existe pas)
-- ============================================
CREATE TABLE IF NOT EXISTS acomptes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salary_id UUID REFERENCES salaries(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- 3. TABLE SALARY_HISTORY (historique mensuel)
-- ============================================
CREATE TABLE IF NOT EXISTS salary_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salary_id UUID REFERENCES salaries(id) ON DELETE CASCADE NOT NULL,
  mois_annee TEXT NOT NULL, -- Format: 'YYYY-MM' (ex: '2024-01')
  salaire_mensuel DECIMAL(10, 2) NOT NULL,
  total_acomptes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  solde_restant DECIMAL(10, 2) NOT NULL,
  nom TEXT NOT NULL, -- Nom du salarié au moment de l'enregistrement
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(salary_id, mois_annee)
);

-- ============================================
-- 4. AJOUTER COLONNE mois_annee À acomptes
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'acomptes' AND column_name = 'mois_annee'
    ) THEN
        ALTER TABLE acomptes ADD COLUMN mois_annee TEXT;
        -- Mettre à jour les acomptes existants avec le mois_annee basé sur la date
        UPDATE acomptes SET mois_annee = TO_CHAR(date, 'YYYY-MM') WHERE mois_annee IS NULL;
    END IF;
END $$;

-- ============================================
-- 5. INDEX POUR PERFORMANCES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_acomptes_salary_id ON acomptes(salary_id);
CREATE INDEX IF NOT EXISTS idx_acomptes_date ON acomptes(date);
CREATE INDEX IF NOT EXISTS idx_acomptes_mois_annee ON acomptes(mois_annee);
CREATE INDEX IF NOT EXISTS idx_salary_history_salary_id ON salary_history(salary_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_mois_annee ON salary_history(mois_annee);

-- ============================================
-- 6. FONCTION ET TRIGGER updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_salaries_updated_at ON salaries;
CREATE TRIGGER update_salaries_updated_at 
    BEFORE UPDATE ON salaries
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. DÉSACTIVER RLS (pour développement)
-- ============================================
ALTER TABLE salaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE acomptes DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. COMMENTAIRES
-- ============================================
COMMENT ON TABLE salaries IS 'Salariés avec leur salaire mensuel';
COMMENT ON TABLE acomptes IS 'Acomptes versés aux salariés';
COMMENT ON TABLE salary_history IS 'Historique mensuel des salaires et acomptes';
COMMENT ON COLUMN salary_history.mois_annee IS 'Mois et année au format YYYY-MM (ex: 2024-01)';
COMMENT ON COLUMN acomptes.mois_annee IS 'Mois et année au format YYYY-MM (ex: 2024-01)';

