#!/bin/sh

echo "Lancement du contrôle qualité..."

# On se place à la racine du projet Git pour lancer les commandes
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# --- 1. Tests unitaires PHP ---
echo "\n\033[34mÉtape 1/2 : Tests unitaires PHP...\033[0m"
./vendor/bin/phpunit tests

# On récupère le résultat de la dernière commande (0 = succès, autre = échec)
PHP_RESULT=$?

# Si les tests PHP ont échoué...
if [ $PHP_RESULT -ne 0 ]; then
  echo "\n\033[41mCOMMIT BLOQUÉ\033[0m : Les tests unitaires PHP ont échoué."
  echo "Veuillez corriger les erreurs avant de pouvoir commiter."
  exit 1 # On bloque le commit
fi
echo "\033[32mTests PHP réussis.\033[0m"

# --- 2. Tests unitaires JavaScript ---
echo "\n\033[34mÉtape 2/2 : Tests unitaires JavaScript...\033[0m"
npm test

# On récupère le résultat de la dernière commande
JS_RESULT=$?

# Si les tests JS ont échoué...
if [ $JS_RESULT -ne 0 ]; then
  echo "\n\033[41mCOMMIT BLOQUÉ\033[0m : Les tests unitaires JavaScript ont échoué."
  echo "Veuillez corriger les erreurs avant de pouvoir commiter."
  exit 1 # On bloque le commit
fi
echo "\033[32mTests JavaScript réussis.\033[0m"


# --- Finalisation ---
echo "\n\033[42mQualité du code validée.\033[0m Commit autorisé."
exit 0 # Tout est OK, on autorise le commit
