<?php
// Fichier : public/index.php
// Point d'entrée unique et routeur pour l'API back-end.

// --- Étape 1: Initialisation de l'environnement ---

// On désactive l'affichage des erreurs pour ne pas corrompre les réponses JSON.
// En développement, les erreurs devraient être consultées dans les logs du serveur.
ini_set('display_errors', 0);
error_reporting(E_ALL);

// On définit les en-têtes HTTP standards pour une API JSON.
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *"); // Pour le développement, à restreindre en production
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Gère les requêtes OPTIONS (pré-vérification) envoyées par les navigateurs.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// --- Étape 2: Chargement de la configuration et des dépendances ---

define('ROOT_PATH', dirname(__DIR__));

if (file_exists(ROOT_PATH . '/config/config.php')) {
    require_once ROOT_PATH . '/config/config.php';
} else {
    http_response_code(503); // Service Unavailable
    echo json_encode(['success' => false, 'message' => "Erreur critique : Fichier de configuration manquant."]);
    exit;
}

// **CORRECTION : S'assurer que les variables critiques sont définies pour éviter les erreurs fatales**
$noms_caisses = $noms_caisses ?? [];
$denominations = $denominations ?? ['billets' => [], 'pieces' => []];
$tpe_par_caisse = $tpe_par_caisse ?? [];
$min_to_keep = $min_to_keep ?? [];

date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');

$currenciesData = [];
if (file_exists(ROOT_PATH . '/config/currencies.json')) {
    $currenciesData = json_decode(file_get_contents(ROOT_PATH . '/config/currencies.json'), true);
}
$current_currency_code = defined('APP_CURRENCY') ? APP_CURRENCY : 'EUR';
$current_currency_symbol = $currenciesData[$current_currency_code]['symbol'] ?? '€';

if (!defined('APP_CURRENCY')) define('APP_CURRENCY', $current_currency_code);
if (!defined('APP_CURRENCY_SYMBOL')) define('APP_CURRENCY_SYMBOL', $current_currency_symbol);

session_start();

if (file_exists(ROOT_PATH . '/vendor/autoload.php')) {
    require_once ROOT_PATH . '/vendor/autoload.php';
}

require_once ROOT_PATH . '/src/Bdd.php';
require_once ROOT_PATH . '/src/Utils.php';

foreach (glob(ROOT_PATH . '/src/services/*.php') as $service) {
    require_once $service;
}

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
    $adminController = new AdminController($pdo, $denominations);
    $authController = new AuthController($pdo);
    $statistiquesController = new StatistiquesController($pdo, $noms_caisses, $denominations);
    $calculateurController = new CalculateurController($pdo, $noms_caisses, $denominations, $tpe_par_caisse);
    $historiqueController = new HistoriqueController($pdo, $noms_caisses, $denominations, $tpe_par_caisse);
    $reserveController = new ReserveController($pdo, $noms_caisses, $denominations);
    $changelogController = new ChangelogController();

} catch (PDOException $e) {
    http_response_code(500);
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

$routes = [
    'GET:calculateur/config' => function() use ($noms_caisses, $denominations, $tpe_par_caisse, $min_to_keep, $current_currency_code, $current_currency_symbol) {
        echo json_encode([
            'success' => true,
            'nomsCaisses' => $noms_caisses,
            'denominations' => $denominations,
            'tpeParCaisse' => $tpe_par_caisse,
            'minToKeep' => $min_to_keep,
            'currencyCode' => $current_currency_code,
            'currencySymbol' => $current_currency_symbol
        ]);
    },
    'GET:calculateur/get_initial_data' => [$calculateurController, 'getInitialData'],
    'POST:calculateur/save' => [$calculateurController, 'save'],
    'POST:calculateur/autosave' => [$calculateurController, 'autosave'],
    'GET:historique/get_data' => [$historiqueController, 'getHistoriqueDataJson'],
    'POST:historique/delete' => [$historiqueController, 'delete'],
    'GET:historique/export_csv' => [$historiqueController, 'exportCsv'],
    'GET:stats/get_data' => [$statistiquesController, 'getStatsData'],
    'GET:cloture/get_state' => [$calculateurController, 'getClotureState'],
    'POST:cloture/confirm_caisse' => [$calculateurController, 'cloture'],
    'POST:cloture/confirm_generale' => [$calculateurController, 'cloture_generale'],
    'GET:reserve/get_data' => [$reserveController, 'getReserveDataJson'],
    'POST:reserve/submit_demande' => [$reserveController, 'submitDemande'],
    'POST:reserve/process_demande' => [$reserveController, 'processDemande'],
    'POST:auth/login' => [$authController, 'login'],
    'GET:auth/logout' => [$authController, 'logout'],
    'POST:admin/action' => [$adminController, 'index'],
    'GET:admin/dashboard_data' => [$adminController, 'getDashboardData'],
    'GET:version/check' => [$adminController, 'gitReleaseCheck'],
    'GET:version/changelog' => [$changelogController, 'index'],
    'GET:version/get_local' => [$adminController, 'getLocalVersion'],
    'GET:update/status' => [$adminController, 'getUpdateStatus'],
    'POST:update/perform_migration' => [$adminController, 'performMigration'],
];

if (array_key_exists($route_key, $routes)) {
    call_user_func($routes[$route_key]);
} else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => "Route API non valide : '$route' pour la méthode '$request_method'"]);
}
