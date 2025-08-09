<?php require 'partials/header.php'; ?>
<style>
    .login-container { max-width: 400px; margin: 100px auto; padding: 30px; background: #fff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .login-container h2 { text-align: center; margin-bottom: 20px; }
    .login-container .form-group { margin-bottom: 15px; }
    .login-container .error { color: #c0392b; background: #fdedec; border: 1px solid #e5a0a0; padding: 10px; border-radius: 4px; text-align: center; }
    .login-container button { width: 100%; }
</style>
<div class="login-container">
    <h2>Administration</h2>
    <?php if (isset($error)): ?>
        <p class="error"><?= htmlspecialchars($error) ?></p>
    <?php endif; ?>
    <form action="index.php?page=login" method="POST">
        <div class="form-group">
            <label for="username">Nom d'utilisateur</label>
            <input type="text" id="username" name="username" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" class="form-control" required>
        </div>
        <button type="submit" class="save-btn">Connexion</button>
    </form>
</div>
<?php require 'partials/footer.php'; ?>
