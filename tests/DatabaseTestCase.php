<?php
// Fichier: tests/DatabaseTestCase.php

use PHPUnit\Framework\TestCase;

abstract class DatabaseTestCase extends TestCase
{
    protected static ?PDO $pdo = null;

    public static function setUpBeforeClass(): void
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
                self::$pdo = new PDO($dsn, $dbUser, $dbPass, $options);
                self::$pdo->exec("DROP DATABASE IF EXISTS `$dbName`");
                self::$pdo->exec("CREATE DATABASE `$dbName`");
                self::$pdo->exec("USE `$dbName`");
                $schema = file_get_contents(__DIR__ . '/../config/schema.sql');
                self::$pdo->exec($schema);
            } catch (PDOException $e) {
                self::markTestSkipped("Connexion à MariaDB échouée, test sauté : " . $e->getMessage());
            }
        } else {
            self::$pdo = new PDO('sqlite::memory:');
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $schema = file_get_contents(__DIR__ . '/../config/schema.sql');
            $statements = preg_split('/;(?=\s*CREATE|\s*$)/', $schema);
            foreach ($statements as $statement) {
                if (empty(trim($statement))) continue;
                $statement = preg_replace('/ENGINE=InnoDB.*$/m', '', $statement);
                $statement = preg_replace('/`id` int\(\d+\) NOT NULL AUTO_INCREMENT/i', '`id` INTEGER PRIMARY KEY AUTOINCREMENT', $statement);
                $statement = preg_replace("/ENUM\((.*?)\)/i", 'TEXT', $statement);
                $statement = str_ireplace('JSON NOT NULL', 'TEXT NOT NULL', $statement);
                $lines = explode("\n", $statement);
                $filteredLines = array_filter($lines, fn($line) => stripos(trim($line), 'PRIMARY KEY') !== 0 && stripos(trim($line), 'UNIQUE KEY') !== 0 && stripos(trim($line), 'FOREIGN KEY') !== 0);
                $statement = implode("\n", $filteredLines);
                $statement = preg_replace('/,\s*\n\)/', "\n)", $statement);
                self::$pdo->exec($statement . ';');
            }
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (getenv('DB_TYPE') === 'mysql' && self::$pdo) {
             $dbName = getenv('DB_NAME_TEST');
             self::$pdo->exec("DROP DATABASE IF EXISTS `$dbName`");
        }
        self::$pdo = null;
    }

    protected function getConnection(): PDO
    {
        if (self::$pdo === null) {
            self::fail('La connexion BDD n\'a pas été initialisée.');
        }
        return self::$pdo;
    }
}
