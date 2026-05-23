-- ============================================
-- TABLE SALARIES ET ACOMPTES
-- ============================================
-- Script SQL pour créer les tables salaries et acomptes dans Supabase
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Table des salariés
CREATE TABLE IF NOT EXISTS salaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  salaire_mensuel DECIMAL(10, 2) NOT NULL,
  contact TEXT,
  poste TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- Fonction pour mettre à jour automatiquement updated_at (si elle n'existe pas déjà)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at sur salaries
DROP TRIGGER IF EXISTS update_salaries_updated_at ON salaries;
CREATE TRIGGER update_salaries_updated_at 
    BEFORE UPDATE ON salaries
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Désactiver RLS pour développement (ou créer des politiques selon vos besoins)
ALTER TABLE salaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE acomptes DISABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE salaries IS 'Salariés avec leur salaire mensuel';
COMMENT ON TABLE acomptes IS 'Acomptes versés aux salariés';
