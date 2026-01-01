-- ============================================
-- SCRIPT POUR RÉCUPÉRER LES ACOMPTES PERDUS
-- ============================================
-- Ce script peut aider à récupérer des acomptes si vous avez une sauvegarde

-- ============================================
-- OPTION 1: Vérifier si les acomptes existent encore dans la table
-- ============================================
-- Exécutez cette requête pour voir tous les acomptes actuellement dans la base
SELECT 
  a.id,
  a.salary_id,
  s.nom as salarie_nom,
  a.montant,
  a.date,
  a.mois_annee,
  a.description,
  a.created_at
FROM acomptes a
LEFT JOIN salaries s ON s.id = a.salary_id
ORDER BY a.date DESC, a.created_at DESC;

-- ============================================
-- OPTION 2: Vérifier les acomptes par mois
-- ============================================
SELECT 
  mois_annee,
  COUNT(*) as nombre_acomptes,
  SUM(montant) as total_montant
FROM acomptes
GROUP BY mois_annee
ORDER BY mois_annee DESC;

-- ============================================
-- OPTION 3: Si vous avez supprimé les acomptes mais qu'ils sont dans salary_history
-- ============================================
-- Vérifier l'historique sauvegardé
SELECT 
  sh.id,
  sh.salary_id,
  sh.nom as salarie_nom,
  sh.mois_annee,
  sh.salaire_mensuel,
  sh.total_acomptes,
  sh.solde_restant,
  sh.created_at
FROM salary_history sh
ORDER BY sh.mois_annee DESC, sh.created_at DESC;

-- ============================================
-- OPTION 4: Restaurer depuis un export CSV (si vous avez sauvegardé)
-- ============================================
-- Si vous avez un fichier CSV avec vos acomptes, utilisez l'import CSV de Supabase
-- Table Editor > acomptes > Import data > CSV file
-- 
-- Format CSV attendu:
-- id,salary_id,montant,date,description,created_at
-- (uuid),(uuid),10000.00,2024-01-15,"Acompte janvier",2024-01-15T10:00:00Z

-- ============================================
-- OPTION 5: Vérifier les backups automatiques de Supabase
-- ============================================
-- Allez dans Supabase Dashboard > Database > Backups
-- Vous pouvez restaurer une version précédente de votre base de données

-- ============================================
-- OPTION 6: Si vous avez une colonne mois_annee manquante
-- ============================================
-- Ajouter la colonne mois_annee si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'acomptes' AND column_name = 'mois_annee'
    ) THEN
        ALTER TABLE acomptes ADD COLUMN mois_annee TEXT;
        -- Remplir mois_annee à partir de la date
        UPDATE acomptes SET mois_annee = TO_CHAR(date, 'YYYY-MM') WHERE mois_annee IS NULL;
    END IF;
END $$;

