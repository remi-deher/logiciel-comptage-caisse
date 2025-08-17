<?php
// src/InstallerController.php

class InstallerController
{
    /**
     * Gère les données soumises par le formulaire pour chaque étape.
     */
    public function handlePost($step, $postData)
    {
        $_SESSION['install_data'] = $_SESSION['install_data'] ?? [];
        $errors = [];

        switch ($step) {
            case 2: // Configuration de la base de données
                $_SESSION['install_data']['db'] = $postData;
                try {
                    $dsn = "mysql:host={$postData['db_host']};charset=utf8mb4";
                    $pdo = new PDO($dsn, $postData['db_user'], $postData['db_pass']);
                    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    
                    // Créer la base de données si elle n'existe pas
                    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$postData['db_name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                } catch (PDOException $e) {
                    $errors[] = "Erreur de connexion ou de création de la BDD : " . $e->getMessage();
                }
                break;

            case 3: // Création de l'administrateur
                $_SESSION['install_data']['admin'] = $postData;
                if (empty($postData['admin_user']) || empty($postData['admin_pass'])) {
                    $errors[] = "Le nom d'utilisateur et le mot de passe de l'administrateur ne peuvent pas être vides.";
                }
                break;

            case 4: // Configuration des caisses
                $_SESSION['install_data']['caisses'] = $postData['caisses'];
                foreach ($postData['caisses'] as $caisseName) {
                    if (empty($caisseName)) {
                        $errors[] = "Le nom d'une caisse ne peut pas être vide.";
                        break;
                    }
                }
                break;
        }

        return ['errors' => $errors];
    }

    /**
     * Prépare les données nécessaires pour l'affichage de chaque étape.
     */
    public function getViewData($step, $data, $errors)
    {
        $viewData = ['step' => $step, 'data' => $data, 'errors' => $errors];

        switch ($step) {
            case 1: // Vérifications du serveur
                $viewData['checks'] = [
                    'PHP Version >= 7.4' => version_compare(PHP_VERSION, '7.4', '>='),
                    'Extension PDO MySQL' => extension_loaded('pdo_mysql'),
                    'Extension cURL' => extension_loaded('curl'),
                    'Dossier /config inscriptible' => is_writable(dirname(__DIR__, 2) . '/config'),
                    'Dossier /cache inscriptible' => is_writable(dirname(__DIR__, 2) . '/cache'),
                    'Dossier /backups inscriptible' => is_writable(dirname(__DIR__, 2) . '/backups'),
                ];
                break;
            
            case 5: // Finalisation
                $result = $this->finalizeInstallation();
                $viewData['success'] = $result['success'];
                $viewData['message'] = $result['message'];
                session_destroy(); // Nettoyer la session d'installation
                break;
        }

        return $viewData;
    }

    /**
     * Finalise l'installation en créant les fichiers de configuration et en important le schéma SQL.
     */
    private function finalizeInstallation()
    {
        $data = $_SESSION['install_data'] ?? null;
        if (!$data) {
            return ['success' => false, 'message' => "Les données de session de l'installation sont manquantes."];
        }

        // 1. Créer la connexion à la BDD finale et importer le schéma
        try {
            $db = $data['db'];
            $dsn = "mysql:host={$db['db_host']};dbname={$db['db_name']};charset=utf8mb4";
            $pdo = new PDO($dsn, $db['db_user'], $db['db_pass']);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            $schema = file_get_contents(dirname(__DIR__, 2) . '/config/schema.sql');
            $pdo->exec($schema);

            // 2. Insérer l'administrateur
            $admin = $data['admin'];
            $hashedPassword = password_hash($admin['admin_pass'], PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
            $stmt->execute([$admin['admin_user'], $hashedPassword]);

        } catch (Exception $e) {
            return ['success' => false, 'message' => "Erreur lors de la finalisation de la base de données : " . $e->getMessage()];
        }

        // 3. Écrire le fichier config/config.php
        $this->writeConfigFile($db, $data['caisses']);

        // 4. Écrire le fichier config/admins.php (fichier de secours)
        $this->writeAdminsFile($admin['admin_user'], $hashedPassword);

        return ['success' => true, 'message' => "Installation terminée avec succès !"];
    }

    private function writeConfigFile($db, $caisses)
    {
        $noms_caisses = [];
        $tpe_par_caisse = [];
        foreach ($caisses as $index => $name) {
            $caisse_id = $index + 1;
            $noms_caisses[$caisse_id] = $name;
            $tpe_par_caisse[$caisse_id] = 0; // Par défaut, 0 TPE pour les nouvelles caisses
        }

        // NOUVEAU : Définition des valeurs par défaut pour la nouvelle variable $denominations
        $denominations = [
            'billets' => ['b500' => 500, 'b200' => 200, 'b100' => 100, 'b50' => 50, 'b20' => 20, 'b10' => 10, 'b5' => 5],
            'pieces'  => ['p200' => 2, 'p100' => 1, 'p050' => 0.50, 'p020' => 0.20, 'p010' => 0.10, 'p005' => 0.05, 'p002' => 0.02, 'p001' => 0.01]
        ];

        // NOUVEAU : Définition des valeurs par défaut pour la nouvelle variable $min_to_keep
        $min_to_keep = [
            'b5' => 2,
            'p200' => 5,
            'p100' => 10,
        ];
        
        $configContent = "<?php\n\n";
        $configContent .= "// Paramètres de connexion à la base de données\n";
        $configContent .= "define('DB_HOST', '" . addslashes($db['db_host']) . "');\n";
        $configContent .= "define('DB_NAME', '" . addslashes($db['db_name']) . "');\n";
        $configContent .= "define('DB_USER', '" . addslashes($db['db_user']) . "');\n";
        $configContent .= "define('DB_PASS', '" . addslashes($db['db_pass']) . "');\n\n";
        $configContent .= "// URL du dépôt Git pour le pied de page\n";
        $configContent .= "define('GIT_REPO_URL', 'https://github.com/remi-deher/logiciel-comptage-caisse');\n\n";
        $configContent .= "// Fuseau horaire de l'application\n";
        $configContent .= "define('APP_TIMEZONE', 'Europe/Paris');\n\n";
        $configContent .= "// Configuration de l'application\n";
        $configContent .= '$noms_caisses = ' . var_export($noms_caisses, true) . ";\n";
        $configContent .= '$tpe_par_caisse = ' . var_export($tpe_par_caisse, true) . ";\n";
        $configContent .= '$denominations = ' . var_export($denominations, true) . ";\n";
        $configContent .= '$min_to_keep = ' . var_export($min_to_keep, true) . ";\n";

        file_put_contents(dirname(__DIR__, 2) . '/config/config.php', $configContent);
    }

    private function writeAdminsFile($username, $hashedPassword)
    {
        $adminsArray = [$username => $hashedPassword];
        $adminsContent = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($adminsArray, true) . ";\n";
        file_put_contents(dirname(__DIR__, 2) . '/config/admins.php', $adminsContent);
    }
}
