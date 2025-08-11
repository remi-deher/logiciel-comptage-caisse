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
            mkdir($this->backupDir, 0755, true);
        }
    }

    /**
     * Crée une sauvegarde compressée de la base de données.
     * @return array ['success' => bool, 'message' => string]
     */
    public function createBackup() {
        $backupFile = $this->backupDir . '/backup-' . date('Y-m-d-H-i-s') . '.sql.gz';
        
        // Construit la commande mysqldump pour la sauvegarde
        $command = sprintf(
            'mysqldump -h %s -u %s -p%s %s | gzip > %s',
            escapeshellarg(DB_HOST),
            escapeshellarg(DB_USER),
            escapeshellarg(DB_PASS),
            escapeshellarg(DB_NAME),
            escapeshellarg($backupFile)
        );

        @exec($command, $output, $return_var);

        if ($return_var === 0) {
            return ['success' => true, 'message' => "Sauvegarde créée avec succès."];
        } else {
            return ['success' => false, 'message' => "Erreur lors de la création de la sauvegarde."];
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
