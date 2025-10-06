<?php
// tests/AuthControllerTest.php

class AuthControllerTest extends DatabaseTestCase
{
    // On supprime la ligne "private $pdo;" qui causait l'erreur
    private $authController;

    protected function setUp(): void
    {
        parent::setUp();
        // On récupère la connexion PDO directement depuis la classe parente
        $pdo = $this->getConnection();
        $this->authController = new AuthController($pdo);

        // On insère un admin de test dans la BDD
        $hash = password_hash('password123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES ('testuser', ?)");
        $stmt->execute([$hash]);
    }

    public function testLoginSuccessWithDatabase()
    {
        // Simule une requête POST
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST['username'] = 'testuser';
        $_POST['password'] = 'password123';
        
        // Simule la session
        $_SESSION = [];

        // On intercepte la sortie pour l'analyser
        ob_start();
        $this->authController->login();
        $output = ob_get_clean();
        
        $result = json_decode($output, true);

        $this->assertTrue($result['success']);
        $this->assertEquals('Connexion réussie.', $result['message']);
        $this->assertTrue($_SESSION['is_admin']);
    }

    public function testLoginFailureWithWrongPassword()
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST['username'] = 'testuser';
        $_POST['password'] = 'wrongpassword';
        $_SESSION = [];

        // Le contrôleur renvoie un code HTTP 401 en cas d'échec
        // Note: Pour tester cela, vous pourriez avoir besoin de mettre en place
        // un système plus avancé pour intercepter les headers, mais pour l'instant,
        // on vérifie la sortie et l'état de la session.
        ob_start();
        $this->authController->login();
        $output = ob_get_clean();
        $result = json_decode($output, true);

        $this->assertFalse($result['success']);
        $this->assertArrayNotHasKey('is_admin', $_SESSION);
    }
}
