<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation - Comptage Caisse</title>
    <!-- Le chemin vers le CSS remonte d'un niveau pour sortir du dossier /install -->
    <link href="../css/installer.css" rel="stylesheet">
</head>
<body>
    <div class="installer-container">
        <div class="installer-header">
            <h1>&#128176; Installation de l'Application</h1>
        </div>

        <div class="steps-indicator">
            <div class="step <?= $viewData['step'] >= 1 ? 'active' : '' ?>">1. Vérification</div>
            <div class="step <?= $viewData['step'] >= 2 ? 'active' : '' ?>">2. Base de données</div>
            <div class="step <?= $viewData['step'] >= 3 ? 'active' : '' ?>">3. Administrateur</div>
            <div class="step <?= $viewData['step'] >= 4 ? 'active' : '' ?>">4. Caisses</div>
            <div class="step <?= $viewData['step'] >= 5 ? 'active' : '' ?>">5. Terminé</div>
        </div>

        <div class="installer-content">
            <?php if (!empty($viewData['errors'])): ?>
                <div class="error-box">
                    <?php foreach ($viewData['errors'] as $error): ?>
                        <p><?= htmlspecialchars($error) ?></p>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <!-- Étape 1: Vérification -->
            <?php if ($viewData['step'] === 1): ?>
                <h2>Étape 1: Vérification du serveur</h2>
                <p>Vérification des prérequis pour l'installation.</p>
                <ul class="checks-list">
                    <?php $all_ok = true; foreach ($viewData['checks'] as $label => $is_ok): ?>
                        <li>
                            <span class="check-label"><?= $label ?></span>
                            <?php if ($is_ok): ?>
                                <span class="status-ok">OK</span>
                            <?php else: $all_ok = false; ?>
                                <span class="status-error">Échec</span>
                            <?php endif; ?>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <?php if ($all_ok): ?>
                    <a href="index.php?step=2" class="btn">Continuer</a>
                <?php else: ?>
                    <p class="error-text">Veuillez corriger les éléments en échec avant de continuer.</p>
                <?php endif; ?>
            <?php endif; ?>

            <!-- Étape 2: Base de données -->
            <?php if ($viewData['step'] === 2): ?>
                <h2>Étape 2: Configuration de la base de données</h2>
                <p>Veuillez entrer les informations de connexion à votre base de données MySQL/MariaDB.</p>
                <form action="index.php?step=2" method="POST">
                    <div class="form-group">
                        <label for="db_host">Hôte (IP ou domaine)</label>
                        <input type="text" id="db_host" name="db_host" value="<?= htmlspecialchars($viewData['data']['db']['db_host'] ?? '127.0.0.1') ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="db_name">Nom de la base de données</label>
                        <input type="text" id="db_name" name="db_name" value="<?= htmlspecialchars($viewData['data']['db']['db_name'] ?? 'comptage_caisse') ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="db_user">Nom d'utilisateur</label>
                        <input type="text" id="db_user" name="db_user" value="<?= htmlspecialchars($viewData['data']['db']['db_user'] ?? '') ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="db_pass">Mot de passe</label>
                        <input type="password" id="db_pass" name="db_pass">
                    </div>
                    <button type="submit" class="btn">Tester et Continuer</button>
                </form>
            <?php endif; ?>

            <!-- Étape 3: Administrateur -->
            <?php if ($viewData['step'] === 3): ?>
                <h2>Étape 3: Création du compte Administrateur</h2>
                <p>Ce compte vous permettra de gérer l'application.</p>
                <form action="index.php?step=3" method="POST">
                    <div class="form-group">
                        <label for="admin_user">Nom d'utilisateur</label>
                        <input type="text" id="admin_user" name="admin_user" value="<?= htmlspecialchars($viewData['data']['admin']['admin_user'] ?? 'admin') ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="admin_pass">Mot de passe</label>
                        <input type="password" id="admin_pass" name="admin_pass" required>
                    </div>
                    <button type="submit" class="btn">Créer et Continuer</button>
                </form>
            <?php endif; ?>

            <!-- Étape 4: Caisses -->
            <?php if ($viewData['step'] === 4): ?>
                <h2>Étape 4: Configuration des caisses</h2>
                <p>Nommez les caisses que vous souhaitez gérer (2 par défaut).</p>
                <form action="index.php?step=4" method="POST">
                    <div class="form-group">
                        <label for="caisse1">Nom de la Caisse 1</label>
                        <input type="text" id="caisse1" name="caisses[]" value="<?= htmlspecialchars($viewData['data']['caisses'][0] ?? 'Caisse Principale') ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="caisse2">Nom de la Caisse 2</label>
                        <input type="text" id="caisse2" name="caisses[]" value="<?= htmlspecialchars($viewData['data']['caisses'][1] ?? 'Caisse Secondaire') ?>" required>
                    </div>
                    <button type="submit" class="btn">Finaliser l'Installation</button>
                </form>
            <?php endif; ?>

            <!-- Étape 5: Terminé -->
            <?php if ($viewData['step'] === 5): ?>
                <h2>Étape 5: Installation Terminée !</h2>
                <?php if ($viewData['success']): ?>
                    <div class="success-box">
                        <p>Félicitations ! L'application a été installée avec succès.</p>
                        <p class="security-warning">Pour des raisons de sécurité, veuillez immédiatement <strong>supprimer le dossier <code>public/install</code></strong> de votre serveur.</p>
                        <a href="../index.php" class="btn">Accéder à l'application</a>
                    </div>
                <?php else: ?>
                    <div class="error-box">
                        <p>Une erreur est survenue lors de la finalisation :</p>
                        <p><?= htmlspecialchars($viewData['message']) ?></p>
                        <a href="index.php?step=2" class="btn">Retourner à la configuration</a>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
