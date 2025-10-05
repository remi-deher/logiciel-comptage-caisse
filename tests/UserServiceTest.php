<?php
class UserServiceTest extends DatabaseTestCase
{
    public function testCannotDeleteSelf()
    {
        parent::setUp();
        $pdo = $this->getConnection();
        $userService = new UserService($pdo);
        
        $currentUser = 'admin_connecte';
        $pdo->exec("INSERT INTO admins (username, password_hash) VALUES ('$currentUser', 'hash123')");
        
        $_SESSION['admin_username'] = $currentUser;

        $userService->deleteAdmin($currentUser);

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = ?");
        $stmt->execute([$currentUser]);
        $this->assertEquals(1, $stmt->fetchColumn());
        unset($_SESSION['admin_username']);
    }
}
