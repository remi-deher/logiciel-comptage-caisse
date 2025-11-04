<?php
// Fichier : public/index.php

// --- Étape 1: Initialisation de l'environnement ---
ini_set('display_errors', 0);
error_reporting(E_ALL);

if (!defined('PHPUNIT_RUNNING')) {
    header("Content-Type: application/json; charset=UTF-8");
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit(0); }
}

// --- Étape 2: Chargement de la configuration et des dépendances ---
define('ROOT_PATH', dirname(__DIR__));

if (file_exists(ROOT_PATH . '/config/config.php')) {
    require_once ROOT_PATH . '/config/config.php';
} else {
    // ... gestion erreur config manquante ...
    if (is_dir(ROOT_PATH . '/public/install') && strpos($_SERVER['REQUEST_URI'], '/install') === false) { header('Location: install/'); exit; }
    elseif (!is_dir(ROOT_PATH . '/public/install')) { if (!defined('PHPUNIT_RUNNING')) { http_response_code(503); } echo json_encode(['success' => false, 'message' => "Erreur critique : Fichier de configuration manquant et dossier d'installation introuvable."]); exit; }
}

// Utiliser ?? [] pour s'assurer que les variables existent comme tableaux
$noms_caisses = $noms_caisses ?? [];
$denominations = $denominations ?? ['billets' => [], 'pieces' => []];
$tpe_par_caisse = $tpe_par_caisse ?? [];
$min_to_keep = $min_to_keep ?? [];
$rouleaux_pieces = $rouleaux_pieces ?? [];
// --- MODIFIÉ : La variable $target_fonds_de_caisse est supprimée d'ici ---

date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');

// ... chargement currencies.json ...
$currenciesData = [];
if (file_exists(ROOT_PATH . '/config/currencies.json')) { $currenciesData = json_decode(file_get_contents(ROOT_PATH . '/config/currencies.json'), true); }
$current_currency_code = defined('APP_CURRENCY') ? APP_CURRENCY : 'EUR';
$current_currency_symbol = $currenciesData[$current_currency_code]['symbol'] ?? '€';
if (!defined('APP_CURRENCY')) define('APP_CURRENCY', $current_currency_code);
if (!defined('APP_CURRENCY_SYMBOL')) define('APP_CURRENCY_SYMBOL', $current_currency_symbol);


session_start();

if (file_exists(ROOT_PATH . '/vendor/autoload.php')) { require_once ROOT_PATH . '/vendor/autoload.php'; }

require_once ROOT_PATH . '/src/Bdd.php';
require_once ROOT_PATH . '/src/Utils.php';

// Charger tous les services et contrôleurs
foreach (glob(ROOT_PATH . '/src/services/*.php') as $service) { require_once $service; }
require_once ROOT_PATH . '/src/Repository/ComptageRepository.php';
require_once ROOT_PATH . '/src/AdminController.php';
require_once ROOT_PATH . '/src/AideController.php';
require_once ROOT_PATH . '/src/AuthController.php';
require_once ROOT_PATH . '/src/CalculateurController.php';
require_once ROOT_PATH . '/src/ChangelogController.php';
require_once ROOT_PATH . '/src/HistoriqueController.php';
// require_once ROOT_PATH . '/src/InstallerController.php'; // Pas nécessaire ici
require_once ROOT_PATH . '/src/ReserveController.php';
require_once ROOT_PATH . '/src/StatistiquesController.php';


// --- Étape 3: Instanciation des contrôleurs ---
try {
    $pdo = Bdd::getPdo();

    $comptageRepository = new ComptageRepository($pdo);
    $clotureStateService = new ClotureStateService($pdo);
    $backupService = new BackupService();

    $adminController = new AdminController($pdo, $denominations);
    $authController = new AuthController($pdo);
    $statistiquesController = new StatistiquesController($pdo, $noms_caisses, $denominations);
    $calculateurController = new CalculateurController($pdo, $noms_caisses, $denominations, $tpe_par_caisse, $comptageRepository, $backupService);
    $historiqueController = new HistoriqueController($pdo, $comptageRepository);
    $reserveController = new ReserveController($pdo, $noms_caisses, $denominations);
    $changelogController = new ChangelogController();

} catch (PDOException $e) { /* ... gestion erreur BDD ... */ if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); } echo json_encode(['success' => false, 'message' => "Erreur de connexion à la base de données : " . $e->getMessage()]); exit; }
  catch (Exception $e) { /* ... gestion erreur init ... */ if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); } echo json_encode(['success' => false, 'message' => "Erreur d'initialisation de l'application : " . $e->getMessage()]); exit; }


// --- Étape 4: Routeur d'API ---
$route = $_REQUEST['route'] ?? 'default';
$request_method = $_SERVER['REQUEST_METHOD'];
$route_key = "{$request_method}:{$route}";

$routes = [
    // --- MODIFIER CETTE ROUTE ---
    'GET:calculateur/config' => function() use ($pdo, $noms_caisses, $denominations, $tpe_par_caisse, $min_to_keep, $rouleaux_pieces, $current_currency_code, $current_currency_symbol, $clotureStateService) {
        // Récupérer les fonds de caisse de référence depuis la BDD
        $master_fonds_de_caisse_db = [];
        try {
            // Lecture de la colonne 'fond_de_caisse' (anciennement 'fond_cible')
            $stmt = $pdo->query("SELECT id, fond_de_caisse FROM caisses");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $master_fonds_de_caisse_db[$row['id']] = $row['fond_de_caisse'] ?? '0.00';
            }
        } catch (Exception $e) {
            error_log("Erreur récupération fond_de_caisse pour /config: " . $e->getMessage());
        }

        echo json_encode([
            'success' => true,
            'nomsCaisses' => $noms_caisses,
            'denominations' => $denominations,
            'tpeParCaisse' => $tpe_par_caisse,
            'minToKeep' => $min_to_keep,
            'rouleaux_pieces' => $rouleaux_pieces,
            'masterFondsDeCaisse' => $master_fonds_de_caisse_db, // Renommé (anciennement targetFondsDeCaisse)
            'currencyCode' => $current_currency_code,
            'currencySymbol' => $current_currency_symbol,
            'closedCaisses' => $clotureStateService->getClosedCaisses(),
        ]);
    },
    // --- FIN MODIFICATION ---
    'GET:calculateur/get_initial_data' => [$calculateurController, 'getInitialData'],
    'GET:calculateur/get_closed_caisse_data' => [$calculateurController, 'getClosedCaisseData'],
    'POST:calculateur/save' => [$calculateurController, 'save'],
    'POST:calculateur/autosave' => [$calculateurController, 'autosave'],
    'POST:calculateur/load_from_history' => [$calculateurController, 'loadFromHistory'],
    'GET:historique/get_data' => [$historiqueController, 'getHistoriqueDataJson'],
    'POST:historique/delete' => [$historiqueController, 'delete'],
    'GET:historique/export_csv' => [$historiqueController, 'exportCsv'],
    'GET:stats/get_data' => [$statistiquesController, 'getStatsData'],
    'POST:cloture/confirm_caisse' => [$calculateurController, 'cloture'],
    'POST:cloture/confirm_generale' => [$calculateurController, 'cloture_generale'],
    'GET:reserve/get_data' => [$reserveController, 'getReserveDataJson'],
    'POST:reserve/submit_demande' => [$reserveController, 'submitDemande'],
    'POST:reserve/process_demande' => [$reserveController, 'processDemande'],
    'POST:auth/login' => [$authController, 'login'],
    'GET:auth/logout' => [$authController, 'logout'],
    'GET:auth/status' => [$authController, 'status'],
    'POST:admin/action' => [$adminController, 'index'], // Gère toutes les actions POST admin
    'GET:admin/dashboard_data' => [$adminController, 'getDashboardData'],
    'GET:version/check' => [$adminController, 'gitReleaseCheck'],
    'GET:version/changelog' => [$changelogController, 'index'],
    'GET:version/get_local' => [$adminController, 'getLocalVersion'],
    'GET:update/status' => [$adminController, 'getUpdateStatus'],
    'POST:update/perform_full_update' => [$adminController, 'performFullUpdate'],
    'POST:update/perform_migration' => [$adminController, 'performMigration'],

];

if (array_key_exists($route_key, $routes)) {
    call_user_func($routes[$route_key]);
} else {
    if (!defined('PHPUNIT_RUNNING')) { http_response_code(404); }
    echo json_encode(['success' => false, 'message' => "Route API non valide : '$route' pour la méthode '$request_method'"]);
}
