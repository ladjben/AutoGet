-- Création des tables pour l'application de gestion de marchandise

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

-- Table des variantes
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

-- Table des lignes d'entrée (détails de chaque entrée)
CREATE TABLE IF NOT EXISTS entree_lignes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entree_id UUID REFERENCES entrees(id) ON DELETE CASCADE NOT NULL,
  variante_id UUID REFERENCES variantes(id) NOT NULL,
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

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_variantes_produit_id ON variantes(produit_id);
CREATE INDEX IF NOT EXISTS idx_entrees_fournisseur_id ON entrees(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_entree_lignes_entree_id ON entree_lignes(entree_id);
CREATE INDEX IF NOT EXISTS idx_entree_lignes_variante_id ON entree_lignes(variante_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseur_id ON paiements(fournisseur_id);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produits_updated_at BEFORE UPDATE ON produits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variantes_updated_at BEFORE UPDATE ON variantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entrees_updated_at BEFORE UPDATE ON entrees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Commentaires sur les tables
COMMENT ON TABLE fournisseurs IS 'Fournisseurs de chaussures';
COMMENT ON TABLE produits IS 'Produits (chaussures)';
COMMENT ON TABLE variantes IS 'Variantes de produits (taille, couleur, modèle)';
COMMENT ON TABLE entrees IS 'Entrées de marchandise';
COMMENT ON TABLE entree_lignes IS 'Lignes détaillées des entrées';
COMMENT ON TABLE paiements IS 'Paiements aux fournisseurs';

