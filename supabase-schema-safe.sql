-- ============================================
-- SCHEMA COMPLET POUR GESTION MARCHANDISE
-- Version sécurisée - peut être exécuté plusieurs fois
-- ============================================

-- Table des fournisseurs
CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  contact TEXT,
  adresse TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des produits
CREATE TABLE IF NOT EXISTS produits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  reference TEXT,
  prix_achat DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des variantes (optionnel, pour compatibilité future)
CREATE TABLE IF NOT EXISTS variantes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produit_id UUID REFERENCES produits(id) ON DELETE CASCADE NOT NULL,
  taille TEXT,
  couleur TEXT,
  modele TEXT,
  quantite INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des entrées de stock
CREATE TABLE IF NOT EXISTS entrees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  fournisseur_id UUID REFERENCES fournisseurs(id) NOT NULL,
  paye BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des lignes d'entrée
CREATE TABLE IF NOT EXISTS entree_lignes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entree_id UUID REFERENCES entrees(id) ON DELETE CASCADE NOT NULL,
  variante_id UUID REFERENCES variantes(id),
  produit_id UUID REFERENCES produits(id),
  quantite INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS paiements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fournisseur_id UUID REFERENCES fournisseurs(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des dépenses
CREATE TABLE IF NOT EXISTS depenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  montant DECIMAL(10, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des comptes utilisateurs
CREATE TABLE IF NOT EXISTS comptes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insérer les comptes par défaut (ignorer si déjà existants)
INSERT INTO comptes (username, password, nom, role) VALUES
  ('admin', 'admin123', 'Administrateur', 'admin'),
  ('user', 'user123', 'Utilisateur', 'user')
ON CONFLICT (username) DO NOTHING;

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_variantes_produit_id ON variantes(produit_id);
CREATE INDEX IF NOT EXISTS idx_entrees_fournisseur_id ON entrees(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_entree_lignes_entree_id ON entree_lignes(entree_id);
CREATE INDEX IF NOT EXISTS idx_entree_lignes_variante_id ON entree_lignes(variante_id);
CREATE INDEX IF NOT EXISTS idx_entree_lignes_produit_id ON entree_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseur_id ON paiements(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date);
CREATE INDEX IF NOT EXISTS idx_comptes_username ON comptes(username);
CREATE INDEX IF NOT EXISTS idx_comptes_role ON comptes(role);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Supprimer les triggers existants avant de les recréer
DROP TRIGGER IF EXISTS update_fournisseurs_updated_at ON fournisseurs;
DROP TRIGGER IF EXISTS update_produits_updated_at ON produits;
DROP TRIGGER IF EXISTS update_variantes_updated_at ON variantes;
DROP TRIGGER IF EXISTS update_entrees_updated_at ON entrees;
DROP TRIGGER IF EXISTS update_comptes_updated_at ON comptes;
DROP TRIGGER IF EXISTS update_depenses_updated_at ON depenses;

-- Créer les triggers
CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produits_updated_at BEFORE UPDATE ON produits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variantes_updated_at BEFORE UPDATE ON variantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entrees_updated_at BEFORE UPDATE ON entrees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comptes_updated_at BEFORE UPDATE ON comptes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_depenses_updated_at BEFORE UPDATE ON depenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Commentaires sur les tables
COMMENT ON TABLE fournisseurs IS 'Fournisseurs de chaussures';
COMMENT ON TABLE produits IS 'Produits (chaussures)';
COMMENT ON TABLE variantes IS 'Variantes de produits (taille, couleur, modèle)';
COMMENT ON TABLE entrees IS 'Entrées de marchandise';
COMMENT ON TABLE entree_lignes IS 'Lignes détaillées des entrées';
COMMENT ON TABLE paiements IS 'Paiements aux fournisseurs';
COMMENT ON TABLE depenses IS 'Dépenses quotidiennes';
COMMENT ON TABLE comptes IS 'Comptes utilisateurs (admin et user)';

-- Désactiver RLS pour développement
ALTER TABLE IF EXISTS fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entrees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entree_lignes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS paiements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS depenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comptes DISABLE ROW LEVEL SECURITY;

