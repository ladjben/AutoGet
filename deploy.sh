#!/bin/bash

echo "🚀 Déploiement de l'application sur Vercel"
echo ""

# Vérifier si Git est initialisé
if [ ! -d .git ]; then
    echo "❌ Git n'est pas initialisé"
    exit 1
fi

# Afficher le statut
echo "📋 Statut Git:"
git status
echo ""

# Demander à l'utilisateur
echo "⚠️  IMPORTANT: Votre dépôt GitHub n'est pas encore configuré."
echo ""
echo "📝 Suivez ces étapes:"
echo ""
echo "1️⃣  Allez sur https://github.com et créez un nouveau dépôt appelé 'autoget'"
echo ""
echo "2️⃣  Une fois créé, exécutez:"
echo ""
echo "    git remote add origin https://github.com/VOTRE-NOM/autoget.git"
echo "    git push -u origin main"
echo ""
echo "3️⃣  Ensuite, déployez sur Vercel:"
echo ""
echo "    - Allez sur https://vercel.com"
echo "    - Connectez-vous avec GitHub"
echo "    - Cliquez 'Import Project'"
echo "    - Sélectionnez votre dépôt 'autoget'"
echo "    - Cliquez 'Deploy'"
echo ""
echo "📄 Consultez INSTRUCTIONS_DEPLOIEMENT.md pour plus de détails"
echo ""


