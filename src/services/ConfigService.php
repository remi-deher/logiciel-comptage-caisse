<?php
// src/services/ConfigService.php

/**
 * Gère la lecture et l'écriture du fichier de configuration de l'application.
 */
class ConfigService {
    private $configPath;

    public function __construct() {
        $this->configPath = dirname(__DIR__, 2) . '/config/config.php';
    }

    /**
     * Met à jour le fichier de configuration avec les nouvelles valeurs fournies.
     * @param array $updates Un tableau contenant les clés à mettre à jour (ex: 'defines', 'noms_caisses').
     * @return array ['success' => bool, 'message' => string|null]
     */
    public function updateConfigFile($updates) {
        global $noms_caisses, $denominations, $tpe_par_caisse, $min_to_keep;

        // On charge les valeurs actuelles pour ne pas les écraser
        $current_defines = [
            'DB_HOST' => defined('DB_HOST') ? DB_HOST : '',
            'DB_NAME' => defined('DB_NAME') ? DB_NAME : '',
            'DB_USER' => defined('DB_USER') ? DB_USER : '',
            'DB_PASS' => defined('DB_PASS') ? DB_PASS : '',
            'GIT_REPO_URL' => defined('GIT_REPO_URL') ? GIT_REPO_URL : '',
            'APP_TIMEZONE' => defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris',
            'APP_CURRENCY' => defined('APP_CURRENCY') ? APP_CURRENCY : 'EUR',
        ];

        // On applique les mises à jour
        if (isset($updates['defines'])) {
            $current_defines = array_merge($current_defines, $updates['defines']);
        }
        if (isset($updates['noms_caisses'])) {
            $noms_caisses = $updates['noms_caisses'];
        }
        if (isset($updates['tpe_par_caisse'])) {
            $tpe_par_caisse = $updates['tpe_par_caisse'];
        }
        // MODIFICATION CI-DESSOUS : On ajoute la gestion de min_to_keep
        if (isset($updates['min_to_keep'])) {
            // On s'assure de ne garder que les entrées avec une valeur numérique > 0
            $min_to_keep = array_filter($updates['min_to_keep'], function($value) {
                return is_numeric($value) && $value > 0;
            });
        }
        if (isset($updates['denominations'])) {
            $denominations = $updates['denominations'];
        }

        // On construit le nouveau contenu du fichier de configuration
        $new_content = "<?php\n\n";
        $new_content .= "// Paramètres de connexion à la base de données\n";
        foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $def) {
            $new_content .= "define('{$def}', '" . addslashes($current_defines[$def]) . "');\n";
        }
        $new_content .= "\n// URL du dépôt Git pour le pied de page\n";
        $new_content .= "define('GIT_REPO_URL', '" . addslashes($current_defines['GIT_REPO_URL']) . "');\n\n";
        $new_content .= "// Fuseau horaire de l'application\n";
        $new_content .= "define('APP_TIMEZONE', '" . addslashes($current_defines['APP_TIMEZONE']) . "');\n\n";
        $new_content .= "// Devise de l'application\n";
        $new_content .= "define('APP_CURRENCY', '" . addslashes($current_defines['APP_CURRENCY']) . "');\n\n";
        $new_content .= "// Configuration de l'application\n";
        $new_content .= '$noms_caisses = ' . var_export($noms_caisses, true) . ";\n";
        $new_content .= '$tpe_par_caisse = ' . var_export($tpe_par_caisse, true) . ";\n";
        $new_content .= '$denominations = ' . var_export($denominations, true) . ";\n";
        $new_content .= '$min_to_keep = ' . var_export($min_to_keep, true) . ";\n";

        if (is_writable($this->configPath)) {
            file_put_contents($this->configPath, $new_content, LOCK_EX);
            return ['success' => true];
        } else {
            return ['success' => false, 'message' => "Erreur critique : Le fichier de configuration n'est pas accessible en écriture."];
        }
    }
}
