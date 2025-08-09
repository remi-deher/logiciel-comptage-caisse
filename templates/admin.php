<?php require __DIR__ . '/partials/header.php'; ?>
<?php require __DIR__ . '/partials/navbar.php'; ?>
<div class="container">
    <h2>Panneau d'Administration</h2>
    <p>Connecté en tant que : <strong><?= htmlspecialchars($_SESSION['admin_username']) ?></strong></p>

    <?php if (isset($_SESSION['admin_message'])): ?>
        <p class="session-message"><?= htmlspecialchars($_SESSION['admin_message']) ?></p>
        <?php unset($_SESSION['admin_message']); ?>
    <?php endif; ?>
    <?php if (isset($_SESSION['admin_error'])): ?>
        <p class="error" style="color: #c0392b; background: #fdedec; border: 1px solid #e5a0a0; padding: 10px; border-radius: 4px;"><?= htmlspecialchars($_SESSION['admin_error']) ?></p>
        <?php unset($_SESSION['admin_error']); ?>
    <?php endif; ?>

    <!-- Section Gestion des Administrateurs -->
    <div class="admin-section">
        <h3>Gestion des Administrateurs</h3>
        <table class="history-table">
            <thead>
                <tr>
                    <th>Nom d'utilisateur</th>
                    <th>Source</th>
                    <th>Statut</th>
                    <th style="text-align: right;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach($admins as $username => $data): ?>
                    <tr>
                        <td><strong><?= htmlspecialchars($username) ?></strong></td>
                        <td>
                            <?php if($data['in_db']) echo 'BDD'; ?>
                            <?php if($data['in_db'] && $data['in_fallback']) echo ' & '; ?>
                            <?php if($data['in_fallback']) echo 'Secours'; ?>
                        </td>
                        <td>
                            <?php if($data['sync_status'] === 'ok'): ?>
                                <span style="color: #27ae60;">Synchronisé</span>
                            <?php elseif($data['sync_status'] === 'mismatch'): ?>
                                <span style="color: #f39c12;">Désynchronisé</span>
                            <?php else: ?>
                                <span style="color: #e67e22;">Partiel</span>
                            <?php endif; ?>
                        </td>
                        <td class="action-cell">
                            <?php if($data['sync_status'] === 'mismatch' || $data['sync_status'] === 'db_only'): ?>
                                <form action="index.php?page=admin" method="POST" style="margin:0;">
                                    <input type="hidden" name="action" value="sync_single_admin">
                                    <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                    <button type="submit" class="new-btn" style="padding: 5px 10px; font-size: 0.9em;">Synchroniser</button>
                                </form>
                            <?php endif; ?>
                            <form action="index.php?page=admin" method="POST" style="margin:0;" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cet administrateur ?');">
                                <input type="hidden" name="action" value="delete_admin">
                                <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                <button type="submit" class="delete-btn" <?= ($username === $_SESSION['admin_username'] || str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?>>Supprimer</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <!-- Section Configuration BDD -->
    <div class="admin-section" style="margin-top: 40px;">
        <h3>Configuration de la Base de Données</h3>
        <form action="index.php?page=admin" method="POST">
            <input type="hidden" name="action" value="update_db_config">
            <div class="form-group"><label>Hôte (IP/Domaine)</label><input type="text" name="db_host" value="<?= htmlspecialchars(DB_HOST) ?>"></div>
            <div class="form-group"><label>Nom de la base</label><input type="text" name="db_name" value="<?= htmlspecialchars(DB_NAME) ?>"></div>
            <div class="form-group"><label>Utilisateur</label><input type="text" name="db_user" value="<?= htmlspecialchars(DB_USER) ?>"></div>
            <div class="form-group"><label>Mot de passe</label><input type="password" name="db_pass" value="<?= htmlspecialchars(DB_PASS) ?>"></div>
            <button type="submit" class="save-btn">Mettre à jour la configuration</button>
        </form>
    </div>

    <!-- Section Sauvegardes -->
    <div class="admin-section" style="margin-top: 40px;">
        <h3>Sauvegardes de la Base de Données</h3>
        <form action="index.php?page=admin" method="POST" style="margin-bottom: 20px;">
            <input type="hidden" name="action" value="create_backup">
            <button type="submit" class="new-btn">Créer une nouvelle sauvegarde</button>
        </form>
        <h4>Sauvegardes existantes :</h4>
        <?php if (empty($backups)): ?>
            <p>Aucune sauvegarde trouvée.</p>
        <?php else: ?>
            <ul class="backup-list">
                <?php foreach($backups as $backup): ?>
                    <li>
                        <span><?= htmlspecialchars($backup) ?></span>
                        <a href="index.php?page=admin&action=download_backup&file=<?= urlencode($backup) ?>" class="download-link">Télécharger</a>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</div>
<?php require __DIR__ . '/partials/footer.php'; ?>
