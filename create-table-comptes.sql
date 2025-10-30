-- ============================================
-- TABLE COMPTES
-- ============================================
-- Script SQL pour créer la table comptes dans Supabase
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Table des comptes utilisateurs
CREATE TABLE IF NOT EXISTS comptes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nom TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_comptes_username ON comptes(username);
CREATE INDEX IF NOT EXISTS idx_comptes_active ON comptes(active);
CREATE INDEX IF NOT EXISTS idx_comptes_role ON comptes(role);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_comptes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
DROP TRIGGER IF EXISTS update_comptes_updated_at ON comptes;
CREATE TRIGGER update_comptes_updated_at 
    BEFORE UPDATE ON comptes
    FOR EACH ROW 
    EXECUTE FUNCTION update_comptes_updated_at();

-- Désactiver RLS pour développement (ou créer des politiques selon vos besoins)
ALTER TABLE comptes DISABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE comptes IS 'Comptes utilisateurs de l''application';
COMMENT ON COLUMN comptes.role IS 'Rôle de l''utilisateur: admin ou user';
COMMENT ON COLUMN comptes.active IS 'Indique si le compte est actif';

