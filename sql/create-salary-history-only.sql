-- ============================================
-- TABLE SALARY_HISTORY UNIQUEMENT
-- ============================================
-- Script SQL pour créer uniquement la table salary_history dans Supabase

-- Table d'historique des salaires par mois
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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_salary_history_salary_id ON salary_history(salary_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_mois_annee ON salary_history(mois_annee);

-- Désactiver RLS pour développement
ALTER TABLE salary_history DISABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE salary_history IS 'Historique mensuel des salaires et acomptes';
COMMENT ON COLUMN salary_history.mois_annee IS 'Mois et année au format YYYY-MM (ex: 2024-01)';

