-- ============================================
-- VÉRIFICATION DES TABLES MANQUANTES
-- ============================================
-- Script pour vérifier quelles tables existent et lesquelles manquent

-- Tables requises par l'application:
-- ✅ acomptes
-- ✅ colis  
-- ✅ comptes
-- ✅ depense_categories
-- ✅ depenses
-- ✅ entree_lignes
-- ✅ entrees
-- ✅ fournisseurs
-- ✅ paiements
-- ✅ produits
-- ✅ salaries
-- ✅ variantes
-- ❌ salary_history (MANQUANTE - nécessaire pour l'historique mensuel)

-- Vérifier si salary_history existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'salary_history'
    ) THEN '✅ salary_history existe'
    ELSE '❌ salary_history MANQUANTE - Exécutez create-salary-history-only.sql'
  END as status;

-- Vérifier toutes les tables de l'application
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'acomptes', 'colis', 'comptes', 'depense_categories', 'depenses',
      'entree_lignes', 'entrees', 'fournisseurs', 'paiements', 'produits',
      'salaries', 'variantes', 'salary_history'
    ) THEN '✅ Requise'
    ELSE '⚠️ Optionnelle'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'acomptes', 'colis', 'comptes', 'depense_categories', 'depenses',
    'entree_lignes', 'entrees', 'fournisseurs', 'paiements', 'produits',
    'salaries', 'variantes', 'salary_history'
  )
ORDER BY table_name;

