-- Script SQL pour créer la table colis dans Supabase
-- Exécuter ce script dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS colis (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre INTEGER NOT NULL CHECK (nombre > 0),
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Créer un index sur la date pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_colis_date ON colis(date DESC);

-- Créer un index sur created_at
CREATE INDEX IF NOT EXISTS idx_colis_created_at ON colis(created_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_colis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_colis_updated_at ON colis;
CREATE TRIGGER update_colis_updated_at
  BEFORE UPDATE ON colis
  FOR EACH ROW
  EXECUTE FUNCTION update_colis_updated_at();

-- Activer RLS (Row Level Security)
ALTER TABLE colis ENABLE ROW LEVEL SECURITY;

-- Policy: Permettre à tous les utilisateurs authentifiés de lire
CREATE POLICY "Permettre lecture colis" ON colis
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Permettre à tous les utilisateurs authentifiés d'insérer
CREATE POLICY "Permettre insertion colis" ON colis
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Permettre à tous les utilisateurs authentifiés de mettre à jour
CREATE POLICY "Permettre mise à jour colis" ON colis
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Permettre à tous les utilisateurs authentifiés de supprimer
CREATE POLICY "Permettre suppression colis" ON colis
  FOR DELETE
  USING (auth.role() = 'authenticated');

