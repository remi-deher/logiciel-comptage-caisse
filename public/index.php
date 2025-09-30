<?php
// Fichier : public/index.php
// Point d'entrée unique et routeur pour l'API back-end.

// --- Étape 1: Initialisation de l'environnement ---

ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// --- Étape 2: Chargement de la configuration et des dépendances ---

define('ROOT_PATH', dirname(__DIR__));

if (file_exists(ROOT_PATH . '/config/config.php')) {
    require_once ROOT_PATH . '/config/config.php';
} else {
    // Si la config n'existe pas, et qu'on n'est pas déjà dans le dossier d'installation
    if (is_dir(ROOT_PATH . '/public/install') && strpos($_SERVER['REQUEST_URI'], '/install') === false) {
        header('Location: install/');
        exit;
    } elseif (!is_dir(ROOT_PATH . '/public/install')) {
        http_response_code(503); // Service Unavailable
        echo json_encode(['success' => false, 'message' => "Erreur critique : Fichier de configuration manquant et dossier d'installation introuvable."]);
        exit;
    }
}

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

// CORRECTION : On inclut le Repository ici
require_once ROOT_PATH . '/src/Repository/ComptageRepository.php';

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
    
    // CORRECTION : On instancie le Repository pour le partager
    $comptageRepository = new ComptageRepository($pdo);
    $clotureStateService = new ClotureStateService($pdo);

    $adminController = new AdminController($pdo, $denominations);
    $authController = new AuthController($pdo);
    $statistiquesController = new StatistiquesController($pdo, $noms_caisses, $denominations);
    // CORRECTION : On injecte le Repository dans les contrôleurs qui en ont besoin
    $calculateurController = new CalculateurController($pdo, $noms_caisses, $denominations, $tpe_par_caisse, $comptageRepository);
    $historiqueController = new HistoriqueController($pdo, $comptageRepository);
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
    'GET:calculateur/config' => function() use ($noms_caisses, $denominations, $tpe_par_caisse, $min_to_keep, $current_currency_code, $current_currency_symbol, $clotureStateService) {
        // CORRECTION : Le service ne fournit plus les caisses verrouillées, seulement les caisses clôturées.
        // Les informations de verrouillage proviennent désormais exclusivement du WebSocket.
        echo json_encode([
            'success' => true,
            'nomsCaisses' => $noms_caisses,
            'denominations' => $denominations,
            'tpeParCaisse' => $tpe_par_caisse,
            'minToKeep' => $min_to_keep,
            'currencyCode' => $current_currency_code,
            'currencySymbol' => $current_currency_symbol,
            'closedCaisses' => $clotureStateService->getClosedCaisses(),
        ]);
    },
    'GET:calculateur/get_initial_data' => [$calculateurController, 'getInitialData'],
    'GET:calculateur/get_closed_caisse_data' => [$calculateurController, 'getClosedCaisseData'],
    'POST:calculateur/save' => [$calculateurController, 'save'],
    'POST:calculateur/autosave' => [$calculateurController, 'autosave'],
    'POST:calculateur/load_from_history' => [$calculateurController, 'loadFromHistory'],
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
