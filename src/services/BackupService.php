<?php
// src/services/BackupService.php

/**
 * Gère toutes les opérations liées aux sauvegardes de la base de données.
 */
class BackupService {
    private $backupDir;

    public function __construct() {
        // Définit le chemin du dossier des sauvegardes
        $this->backupDir = dirname(__DIR__, 2) . '/backups';
        // Crée le dossier s'il n'existe pas
        if (!is_dir($this->backupDir)) {
            // On utilise @ pour éviter les avertissements si le dossier est créé entre-temps (accès concurrentiel)
            @mkdir($this->backupDir, 0755, true);
        }
    }

    /**
     * Crée une sauvegarde compressée de la base de données.
     * @return array ['success' => bool, 'message' => string]
     */
    public function createBackup() {
        // --- AMÉLIORATION 1 : Vérification des permissions ---
        if (!is_writable($this->backupDir)) {
            return [
                'success' => false,
                'message' => "Erreur de permission : Le dossier de sauvegarde ('" . htmlspecialchars($this->backupDir) . "') n'est pas accessible en écriture pour le serveur web."
            ];
        }

        // --- AMÉLIORATION 2 : Trouver le chemin de mysqldump ---
        // Utilise `shell_exec` pour trouver le chemin de l'exécutable, plus fiable que de se baser sur $PATH
        $mysqldump_path = trim(shell_exec('which mysqldump'));
        if (empty($mysqldump_path)) {
            return [
                'success' => false,
                'message' => "Erreur de configuration serveur : La commande 'mysqldump' est introuvable. Veuillez vous assurer qu'elle est installée et accessible."
            ];
        }

        $backupFile = $this->backupDir . '/backup-' . date('Y-m-d-H-i-s') . '.sql.gz';
        
        // --- AMÉLIORATION 3 : Commande plus robuste et capture d'erreur ---
        // On redirige la sortie d'erreur (2>&1) pour capturer les messages de mysqldump
        $command = sprintf(
            '%s -h %s -u %s -p%s %s | gzip > %s 2>&1',
            escapeshellcmd($mysqldump_path),
            escapeshellarg(DB_HOST),
            escapeshellarg(DB_USER),
            escapeshellarg(DB_PASS),
            escapeshellarg(DB_NAME),
            escapeshellarg($backupFile)
        );

        // On n'utilise plus @exec pour pouvoir capturer la sortie en cas d'erreur
        exec($command, $output, $return_var);

        if ($return_var === 0) {
            return ['success' => true, 'message' => "Sauvegarde créée avec succès."];
        } else {
            // On fournit un message d'erreur détaillé
            $errorMessage = "Erreur lors de la création de la sauvegarde.";
            if (!empty($output)) {
                $errorMessage .= " Détail de l'erreur : " . implode("\n", $output);
            }
            return ['success' => false, 'message' => $errorMessage];
        }
    }

    /**
     * Récupère la liste des fichiers de sauvegarde existants, triés du plus récent au plus ancien.
     * @return array
     */
    public function getBackups() {
        if (!is_dir($this->backupDir)) return [];
        
        $files = scandir($this->backupDir, SCANDIR_SORT_DESCENDING);
        // Ne retourne que les fichiers .gz
        return array_filter($files, fn($file) => pathinfo($file, PATHINFO_EXTENSION) === 'gz');
    }
}
