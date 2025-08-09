<?php
// templates/login.php
$body_class = 'login-page-body';
$page_css = 'admin.css'; // La page de login utilise les styles admin
require __DIR__ . '/partials/header.php';
?>
<div class="login-container">
    <h2>Administration</h2>
    <?php if (isset($error)): ?>
        <p class="error"><?= htmlspecialchars($error) ?></p>
    <?php endif; ?>
    <form action="index.php?page=login" method="POST">
        <div class="form-group">
            <label for="username">Nom d'utilisateur</label>
            <input type="text" id="username" name="username" required>
        </div>
        <div class="form-group">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit" class="save-btn">Connexion</button>
    </form>
</div>
</body>
</html>
