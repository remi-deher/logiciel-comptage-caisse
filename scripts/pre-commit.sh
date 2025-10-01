#!/bin/sh

echo "Lancement du contrôle qualité (tests unitaires PHP)..."

# On se place à la racine du projet Git pour lancer la commande
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# Commande pour lancer les tests
./vendor/bin/phpunit tests

# On récupère le résultat de la dernière commande (0 = succès, autre = échec)
RESULT=$?

# Si les tests ont échoué...
if [ $RESULT -ne 0 ]; then
  echo "\n\033[41mCOMMIT BLOQUÉ\033[0m : Les tests unitaires ont échoué."
  echo "Veuillez corriger les erreurs avant de pouvoir commiter."
  exit 1 # On bloque le commit
fi

echo "\n\033[42mTests réussis.\033[0m Commit autorisé."
exit 0 # Tout est OK, on autorise le commit
