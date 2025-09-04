<?php
// Fichier : public/index.php
// Point d'entrée unique et routeur pour l'API back-end.

// --- Étape 1: Initialisation de l'environnement ---

// On s'assure que les erreurs sont rapportées pour le débogage. À commenter en production.
ini_set('display_errors', 1);
error_reporting(E_ALL);

// On définit les en-têtes HTTP standards pour une API JSON.
header("Content-Type: application/json; charset=UTF-8");
// La ligne suivante est utile pour le développement en local. 
// Pour la production, il est recommandé de la remplacer par le domaine de votre application front-end
// ex: header("Access-Control-Allow-Origin: https://monapp.com");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Gère les requêtes OPTIONS (pré-vérification) envoyées par les navigateurs.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// --- Étape 2: Chargement de la configuration et des dépendances ---

// Le chemin de base de l'application pour des inclusions robustes.
define('ROOT_PATH', dirname(__DIR__));

// Chargement de la configuration principale
if (file_exists(ROOT_PATH . '/config/config.php')) {
    require_once ROOT_PATH . '/config/config.php';
} else {
    // Si la configuration n'existe pas, l'API ne peut pas fonctionner.
    http_response_code(503); // Service Unavailable
    echo json_encode(['success' => false, 'message' => "Erreur critique : Fichier de configuration manquant."]);
    exit;
}

// Fuseau horaire et devise de l'application
date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');
$currenciesData = json_decode(file_get_contents(ROOT_PATH . '/config/currencies.json'), true);
$current_currency_code = defined('APP_CURRENCY') ? APP_CURRENCY : 'EUR';
$current_currency_symbol = $currenciesData[$current_currency_code]['symbol'] ?? '€';

if (!defined('APP_CURRENCY')) define('APP_CURRENCY', $current_currency_code);
if (!defined('APP_CURRENCY_SYMBOL')) define('APP_CURRENCY_SYMBOL', $current_currency_symbol);

session_start();

// Autoloader de Composer
if (file_exists(ROOT_PATH . '/vendor/autoload.php')) {
    require_once ROOT_PATH . '/vendor/autoload.php';
}

// Chargement des fichiers principaux
require_once ROOT_PATH . '/src/Bdd.php';
require_once ROOT_PATH . '/src/Utils.php';

// Chargement de tous les services
foreach (glob(ROOT_PATH . '/src/services/*.php') as $service) {
    require_once $service;
}

// Chargement de tous les contrôleurs
require_once ROOT_PATH . '/src/AdminController.php';
require_once ROOT_PATH . '/src/AideController.php';
require_once ROOT_PATH . '/src/AuthController.php';
require_once ROOT_PATH . '/src/CalculateurController.php';
require_once ROOT_PATH . '/src/ChangelogController.php';
require_once ROOT_PATH . '/src/HistoriqueController.php';
require_once ROOT_PATH . '/src/InstallerController.php';
require_once ROOT_PATH . '/src/ReserveController.php';
require_once ROOT_PATH . '/src/StatistiquesController.php';


// --- Étape 3: Instanciation des contrôleurs ---

try {
    $pdo = Bdd::getPdo();

    // Instanciation de tous les contrôleurs avec leurs dépendances
    $adminController = new AdminController($pdo);
    $authController = new AuthController($pdo);
    $statistiquesController = new StatistiquesController($pdo, $noms_caisses, $denominations);
    $calculateurController = new CalculateurController($pdo, $noms_caisses, $denominations, $tpe_par_caisse ?? []);
    $historiqueController = new HistoriqueController($pdo, $noms_caisses, $denominations, $tpe_par_caisse ?? []);
    $reserveController = new ReserveController($pdo, $noms_caisses, $denominations);
    $changelogController = new ChangelogController();

} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => "Erreur de connexion à la base de données : " . $e->getMessage()]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => "Erreur d'initialisation de l'application : " . $e->getMessage()]);
    exit;
}


// --- Étape 4: Routeur d'API ---

$route = $_REQUEST['route'] ?? 'default';
$request_method = $_SERVER['REQUEST_METHOD'];
$route_key = "{$request_method}:{$route}";

// Tableau associatif des routes pour une meilleure lisibilité
$routes = [
    // --- Routes Calculateur ---
    'GET:calculateur/config' => function() use ($noms_caisses, $denominations, $tpe_par_caisse, $min_to_keep, $current_currency_code, $current_currency_symbol) {
        echo json_encode([
            'success' => true,
            'nomsCaisses' => $noms_caisses,
            'denominations' => $denominations,
            'tpeParCaisse' => $tpe_par_caisse ?? [],
            'minToKeep' => $min_to_keep ?? [],
            'currencyCode' => $current_currency_code, // <--- AJOUTÉ
            'currencySymbol' => $current_currency_symbol
        ]);
    },
    'GET:calculateur/get_initial_data' => [$calculateurController, 'getInitialData'],
    'POST:calculateur/save' => [$calculateurController, 'save'],
    'POST:calculateur/autosave' => [$calculateurController, 'autosave'],

    // --- Routes Historique ---
    'GET:historique/get_data' => [$historiqueController, 'getHistoriqueDataJson'],
    'POST:historique/delete' => [$historiqueController, 'delete'],
    'GET:historique/export_csv' => [$historiqueController, 'exportCsv'],

    // --- Routes Statistiques ---
    'GET:stats/get_data' => [$statistiquesController, 'getStatsData'],

    // --- Routes Clôture ---
    'GET:cloture/get_state' => [$calculateurController, 'getClotureState'],
    'POST:cloture/confirm_caisse' => [$calculateurController, 'cloture'],
    'POST:cloture/confirm_generale' => [$calculateurController, 'cloture_generale'],

    // --- Routes Réserve ---
    'GET:reserve/get_data' => [$reserveController, 'getReserveDataJson'],
    'POST:reserve/submit_demande' => [$reserveController, 'submitDemande'],
    'POST:reserve/process_demande' => [$reserveController, 'processDemande'],
    
    // --- Routes Authentification & Admin ---
    'POST:auth/login' => [$authController, 'login'],
    'GET:auth/logout' => [$authController, 'logout'],
    'POST:admin/action' => [$adminController, 'index'], // Gère les actions (ajout, suppression...)
    'GET:admin/dashboard_data' => [$adminController, 'getDashboardData'],

    // --- Routes Système & Version ---
    'GET:version/check' => [$adminController, 'gitReleaseCheck'],
    'GET:version/changelog' => [$changelogController, 'index'],

    // --- Routes Pieds de pages ---

    'GET:version/get_local' => [$adminController, 'getLocalVersion'],
    
    // --- Routes de mise à jour ---
    'GET:update/status' => [$adminController, 'getUpdateStatus'], // Méthode à créer dans AdminController
    'POST:update/perform_migration' => [$adminController, 'performMigration'], // Méthode à créer
];

if (array_key_exists($route_key, $routes)) {
    // Appelle la méthode du contrôleur ou la fonction anonyme correspondant à la route
    call_user_func($routes[$route_key]);
} else {
    // Si la route n'est pas trouvée
    http_response_code(404); // Not Found
    echo json_encode(['success' => false, 'message' => "Route API non valide : '$route' pour la méthode '$request_method'"]);
}
