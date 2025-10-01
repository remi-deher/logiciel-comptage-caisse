<?php
use PHPUnit\Framework\TestCase;

// On charge le service que l'on va tester
require_once __DIR__ . '/../src/services/UserService.php';

class UserServiceTest extends TestCase
{
    private $pdo;
    private $userService;
    private $fallbackFile;

    // Cette fonction prépare un environnement de test propre avant chaque test
    protected function setUp(): void
    {
        // 1. On utilise une base de données en mémoire pour ne pas affecter vos vraies données
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 2. On crée la table 'admins' nécessaire pour les tests
        $this->pdo->exec("CREATE TABLE admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT)");

        // 3. On crée un faux fichier de secours temporaire pour les tests
        $this->fallbackFile = tempnam(sys_get_temp_dir(), 'admins_test');
        
        // 4. On crée une instance du service à tester
        // On "triche" un peu en modifiant sa propriété privée pour qu'elle pointe vers notre fichier temporaire
        $this->userService = new UserService($this->pdo);
        $reflection = new ReflectionClass($this->userService);
        $property = $reflection->getProperty('fallback_file');
        $property->setAccessible(true);
        $property->setValue($this->userService, $this->fallbackFile);
    }

    // Cette fonction nettoie l'environnement après chaque test
    protected function tearDown(): void
    {
        // On supprime notre faux fichier de secours
        if (file_exists($this->fallbackFile)) {
            unlink($this->fallbackFile);
        }
        $this->pdo = null;
    }

    /**
     * Test n°1 : Vérifie que la suppression d'un admin fonctionne correctement.
     */
    public function testDeleteAdmin()
    {
        // Préparation : On ajoute un utilisateur à supprimer
        $usernameToDelete = 'user_a_supprimer';
        $this->pdo->exec("INSERT INTO admins (username, password_hash) VALUES ('$usernameToDelete', 'hash123')");
        file_put_contents($this->fallbackFile, "<?php return ['$usernameToDelete' => 'hash123'];");

        // On simule une session d'un autre admin qui fait la suppression
        $_SESSION['admin_username'] = 'superadmin';

        // Action : On appelle la fonction de suppression
        $this->userService->deleteAdmin($usernameToDelete);

        // Vérification
        // 1. L'utilisateur a-t-il disparu de la base de données ?
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = ?");
        $stmt->execute([$usernameToDelete]);
        $this->assertEquals(0, $stmt->fetchColumn(), "L'utilisateur aurait dû être supprimé de la base de données.");

        // 2. L'utilisateur a-t-il disparu du fichier de secours ?
        $fallbackAdmins = require $this->fallbackFile;
        $this->assertArrayNotHasKey($usernameToDelete, $fallbackAdmins, "L'utilisateur aurait dû être supprimé du fichier de secours.");
    }

    /**
     * Test n°2 : Vérifie qu'un utilisateur ne peut pas se supprimer lui-même.
     */
    public function testCannotDeleteSelf()
    {
        // Préparation : On crée un utilisateur
        $currentUser = 'admin_connecte';
        $this->pdo->exec("INSERT INTO admins (username, password_hash) VALUES ('$currentUser', 'hash123')");
        
        // On simule sa session
        $_SESSION['admin_username'] = $currentUser;

        // Action : L'utilisateur essaie de se supprimer lui-même
        $this->userService->deleteAdmin($currentUser);

        // Vérification : On s'assure qu'il est toujours présent dans la base de données
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = ?");
        $stmt->execute([$currentUser]);
        $this->assertEquals(1, $stmt->fetchColumn(), "L'utilisateur n'aurait pas dû être supprimé.");
        
        // On vérifie qu'un message d'erreur a été stocké en session
        $this->assertStringContainsString("Vous ne pouvez pas supprimer votre propre compte", $_SESSION['admin_error']);
    }
}
