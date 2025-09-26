## Outils Web comptage de caisse

## DISCLAIMER

BEAUCOUP DE BUG EN 5.0

Préférez utiliser la branche oldest pour le déploiement qui est un produit plus stable
la 5.0 est un passage vers une SPA ce qui implique des grosse modifications et un produit non stable
Je travaile uniquement en poussant mon code en branche main au fil de l'eau donc bien se baser sur les releases
pour un déploiement en production

Je travaille actuellement sur mon temps libre pour patcher la 5.0 en fonction des retours utilisateurs

## Fonctionnalité importante

* Prend en charge plusieurs caisse
* Fonction d'historique des saisies
* "sauvegarde automatique" des saisies en cas de soucis
* Possibilité d'exporter les saisies de l'historique
* Possibilité de travailler à plusieurs en temps réel
* Interface de gestion pour gérer les caisses, nom, sauevgarde,.....
* Application responsive

## Environnement

Testé dans un environmment sous Debian 12  sur une base Nginx avec une base de donnée externe et un reverse proxy externe

Une base de donnée MysQL et un serveur Web sont les seuls prérequis avec composer

## Mise en place :

- Modifier le fichier config.php.example dans le dossier config/example
- Modifier le websocket_server.php.example
- Executer le ou utiliser le fichier comptage-ws.service.example pour créer un service
- Importer le fichier schema.sql pour créer les tables
- Faites les modifications necessaire dans votre serveur web (il dois pointer sur le dossier public du projet)
- Un script install.sh se trouve à la racine du projet, celui ci n'a pas été testé pour le moment et nécessitera quelques ajustement
