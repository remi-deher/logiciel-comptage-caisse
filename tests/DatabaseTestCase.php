<?php
// Fichier: tests/DatabaseTestCase.php

use PHPUnit\Framework\TestCase;

abstract class DatabaseTestCase extends TestCase
{
    protected ?PDO $pdo = null;

    /**
     * Exécutée AVANT CHAQUE TEST.
     */
    protected function setUp(): void
    {
        if (getenv('DB_TYPE') === 'mysql') {
            try {
                $dbHost = getenv('DB_HOST');
                $dbPort = getenv('DB_PORT');
                $dbName = getenv('DB_NAME_TEST');
                $dbUser = getenv('DB_USER');
                $dbPass = getenv('DB_PASS');

                $dsn = "mysql:host=$dbHost;port=$dbPort;charset=utf8mb4";
                $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5];
                $this->pdo = new PDO($dsn, $dbUser, $dbPass, $options);
                
                $this->pdo->exec("DROP DATABASE IF EXISTS `$dbName`");
                $this->pdo->exec("CREATE DATABASE `$dbName`");
                $this->pdo->exec("USE `$dbName`");

                $schema = file_get_contents(__DIR__ . '/../config/schema.sql');
                $this->pdo->exec($schema);

            } catch (PDOException $e) {
                $this->markTestSkipped("Connexion à MariaDB échouée, test sauté : " . $e->getMessage());
            }
        } else {
            // Fallback sur SQLite
            $this->pdo = new PDO('sqlite::memory:');
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $schema = file_get_contents(__DIR__ . '/../config/schema.sql');
            
            $statements = preg_split('/;(?=\s*CREATE|\s*$)/', $schema);
            foreach ($statements as $statement) {
                if (empty(trim($statement))) continue;
                $statement = preg_replace('/ENGINE=InnoDB.*$/m', '', $statement);
                $statement = preg_replace('/`id` int\(\d+\) NOT NULL AUTO_INCREMENT/i', '`id` INTEGER PRIMARY KEY AUTOINCREMENT', $statement);
                $statement = preg_replace("/ENUM\((.*?)\)/i", 'TEXT', $statement);
                $statement = str_ireplace('JSON NOT NULL', 'TEXT NOT NULL', $statement);
                $lines = explode("\n", $statement);
                $filteredLines = array_filter($lines, function($line) {
                    return stripos(trim($line), 'PRIMARY KEY') !== 0 &&
                           stripos(trim($line), 'UNIQUE KEY') !== 0 &&
                           stripos(trim($line), 'FOREIGN KEY') !== 0;
                });
                $statement = implode("\n", $filteredLines);
                $statement = preg_replace('/,\s*\n\)/', "\n)", $statement);
                $this->pdo->exec($statement . ';');
            }
        }
    }

    protected function tearDown(): void
    {
        if (getenv('DB_TYPE') === 'mysql' && $this->pdo) {
             $dbName = getenv('DB_NAME_TEST');
             $this->pdo->exec("DROP DATABASE IF EXISTS `$dbName`");
        }
        $this->pdo = null;
    }

    protected function getConnection(): PDO
    {
        if ($this->pdo === null) {
            $this->fail('La connexion BDD n\'a pas été initialisée.');
        }
        return $this->pdo;
    }
}
