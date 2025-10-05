<?php
// tests/AdminControllerUpdateTest.php

require_once __DIR__ . '/DatabaseTestCase.php';
require_once __DIR__ . '/../src/AdminController.php';
require_once __DIR__ . '/../src/AuthController.php';
require_once __DIR__ . '/../src/services/BackupService.php';
require_once __DIR__ . '/../src/services/DatabaseMigrationService.php';
require_once __DIR__ . '/../src/services/VersionService.php';

class AdminControllerUpdateTest extends DatabaseTestCase
{
    public function testPerformFullUpdateOrchestratesCorrectly()
    {
        // --- ARRANGE ---
        $backupServiceMock = $this->createMock(BackupService::class);
        $dbMigrationServiceMock = $this->createMock(DatabaseMigrationService::class);
        
        $backupServiceMock->method('createBackup')->willReturn(['success' => true]);
        $dbMigrationServiceMock->method('generateMigrationSql')->willReturn(['ALTER TABLE...']); // Simule une migration nécessaire
        $dbMigrationServiceMock->method('applyMigration')->willReturn(['success' => true]);

        // On crée un mock du contrôleur pour surcharger uniquement la méthode Git
        $adminControllerMock = $this->getMockBuilder(AdminController::class)
            ->setConstructorArgs([$this->getConnection(), []]) // Le constructeur a besoin du PDO
            ->onlyMethods(['performGitUpdate'])
            ->getMock();

        // On remplace les services internes par nos mocks
        $reflection = new \ReflectionClass($adminControllerMock);
        $backupProp = $reflection->getProperty('backupService');
        $backupProp->setAccessible(true);
        $backupProp->setValue($adminControllerMock, $backupServiceMock);
        
        $migrationProp = $reflection->getProperty('databaseMigrationService');
        $migrationProp->setAccessible(true);
        $migrationProp->setValue($adminControllerMock, $dbMigrationServiceMock);
        
        $adminControllerMock->method('performGitUpdate')->willReturn(['success' => true, 'output' => 'Git pull successful.']);

        $_SESSION['is_admin'] = true;

        // --- ACT ---
        $backupServiceMock->expects($this->once())->method('createBackup');
        $dbMigrationServiceMock->expects($this->once())->method('applyMigration');

        ob_start();
        $adminControllerMock->performFullUpdate();
        $response = ob_get_clean();
        $result = json_decode($response, true);

        // --- ASSERT ---
        $this->assertTrue($result['success']);
        $this->assertStringContainsString('Sauvegarde réussie', $result['message']);
        $this->assertStringContainsString('Mise à jour des fichiers terminée', $result['message']);
        $this->assertStringContainsString('Migration de la base de données terminée', $result['message']);
        
        unset($_SESSION['is_admin']);
    }
}
