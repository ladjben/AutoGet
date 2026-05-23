-- Script pour ajouter la colonne 'nom' à la table depenses
-- Exécuter ce script dans Supabase SQL Editor si vous utilisez Supabase

-- Ajouter la colonne 'nom' si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'depenses' AND column_name = 'nom'
  ) THEN
    ALTER TABLE depenses ADD COLUMN nom TEXT;
    
    -- Mettre à jour les dépenses existantes : utiliser description comme nom si disponible
    UPDATE depenses 
    SET nom = COALESCE(description, 'Sans nom')
    WHERE nom IS NULL;
    
    -- Rendre la colonne obligatoire pour les nouvelles dépenses (optionnel)
    -- ALTER TABLE depenses ALTER COLUMN nom SET NOT NULL;
  END IF;
END $$;

-- Commentaire sur la colonne
COMMENT ON COLUMN depenses.nom IS 'Nom/catégorie de la dépense (ex: Transport, Loyer, etc.)';
