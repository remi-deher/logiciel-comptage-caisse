<?php
// src/services/DatabaseMigrationService.php

class DatabaseMigrationService {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Compare le schéma SQL avec la base de données actuelle et génère les requêtes de migration.
     * @return array Les requêtes SQL à exécuter.
     */
    public function generateMigrationSql() {
        $schemaFile = dirname(__DIR__, 2) . '/config/schema.sql';
        if (!file_exists($schemaFile)) {
            return ['error' => 'Fichier schema.sql introuvable.'];
        }

        $schemaContent = file_get_contents($schemaFile);
        $schemaTables = $this->parseSchema($schemaContent);
        $databaseTables = $this->getDatabaseTables();
        
        $migrationSql = [];

        foreach ($schemaTables as $tableName => $columns) {
            if (!isset($databaseTables[$tableName])) {
                // La table n'existe pas, on la crée
                preg_match('/CREATE TABLE IF NOT EXISTS `'.$tableName.'` \((.*?)\) ENGINE=/is', $schemaContent, $matches);
                if (isset($matches[0])) {
                    $migrationSql[] = $matches[0] . ';';
                }
            } else {
                // La table existe, on vérifie les colonnes
                foreach ($columns as $columnName => $columnDefinition) {
                    if (!in_array($columnName, $databaseTables[$tableName])) {
                        $migrationSql[] = "ALTER TABLE `{$tableName}` ADD COLUMN {$columnDefinition};";
                    }
                }
            }
        }
        
        return $migrationSql;
    }

    /**
     * Applique les requêtes de migration à la base de données.
     */
    public function applyMigration(array $sqlCommands) {
        try {
            foreach ($sqlCommands as $command) {
                $this->pdo->exec($command);
            }
            return ['success' => true];
        } catch (PDOException $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function parseSchema($content) {
        $tables = [];
        preg_match_all('/CREATE TABLE IF NOT EXISTS `(.*?)` \((.*?)\)/is', $content, $matches, PREG_SET_ORDER);
        
        foreach ($matches as $match) {
            $tableName = $match[1];
            $columnsContent = $match[2];
            $columns = [];
            
            preg_match_all('/^\s*`(.+?)`(.+?),?$/m', $columnsContent, $columnMatches, PREG_SET_ORDER);
            foreach ($columnMatches as $colMatch) {
                $columns[$colMatch[1]] = "`" . $colMatch[1] . "`" . trim($colMatch[2]);
            }
            $tables[$tableName] = $columns;
        }
        return $tables;
    }

    private function getDatabaseTables() {
        $tables = [];
        $stmt = $this->pdo->query('SHOW TABLES');
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tableName = $row[0];
            $colStmt = $this->pdo->query("SHOW COLUMNS FROM `{$tableName}`");
            $columns = $colStmt->fetchAll(PDO::FETCH_COLUMN);
            $tables[$tableName] = $columns;
        }
        return $tables;
    }
}
