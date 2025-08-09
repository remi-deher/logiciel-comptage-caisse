<?php require __DIR__ . '/partials/header.php'; ?>
<?php require __DIR__ . '/partials/navbar.php'; ?>
<div class="container">
    <div class="admin-header">
        <h2>Panneau d'Administration</h2>
        <p>Connecté en tant que : <strong><?= htmlspecialchars($_SESSION['admin_username']) ?></strong></p>
    </div>

    <?php if (isset($_SESSION['admin_message'])): ?>
        <p class="session-message"><?= htmlspecialchars($_SESSION['admin_message']) ?></p>
        <?php unset($_SESSION['admin_message']); ?>
    <?php endif; ?>
    <?php if (isset($_SESSION['admin_error'])): ?>
        <p class="error"><?= htmlspecialchars($_SESSION['admin_error']) ?></p>
        <?php unset($_SESSION['admin_error']); ?>
    <?php endif; ?>

    <div class="admin-grid">
        <!-- Carte : Gestion des Caisses -->
        <div class="admin-card">
            <h3>Gestion des Caisses</h3>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nom de la Caisse</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach($caisses as $id => $nom): ?>
                        <tr>
                            <td><?= $id ?></td>
                            <td>
                                <form action="index.php?page=admin" method="POST" class="inline-form">
                                    <input type="hidden" name="action" value="rename_caisse">
                                    <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                    <input type="text" name="caisse_name" value="<?= htmlspecialchars($nom) ?>" class="inline-input">
                                    <button type="submit" class="action-btn-small new-btn">Renommer</button>
                                </form>
                            </td>
                            <td class="action-cell">
                                <form action="index.php?page=admin" method="POST" onsubmit="return confirm('ATTENTION : La suppression d\'une caisse est irréversible et effacera toutes les données de comptage associées. Êtes-vous sûr ?');">
                                    <input type="hidden" name="action" value="delete_caisse">
                                    <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                    <button type="submit" class="action-btn-small delete-btn">Supprimer</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <div class="card-footer">
                <h4>Ajouter une nouvelle caisse</h4>
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="add_caisse">
                    <input type="text" name="caisse_name" required placeholder="Nom de la nouvelle caisse" class="inline-input">
                    <button type="submit" class="action-btn-small save-btn">Ajouter</button>
                </form>
            </div>
        </div>

        <!-- Carte : Gestion des Administrateurs -->
        <div class="admin-card">
            <h3>Gestion des Administrateurs</h3>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Utilisateur</th>
                        <th>Statut</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach($admins as $username => $data): ?>
                        <tr>
                            <td><strong><?= htmlspecialchars($username) ?></strong></td>
                            <td>
                                <?php if($data['sync_status'] === 'ok'): ?>
                                    <span class="status-tag status-ok">Synchronisé</span>
                                <?php elseif($data['sync_status'] === 'mismatch'): ?>
                                    <span class="status-tag status-warning">Désynchronisé</span>
                                <?php else: ?>
                                    <span class="status-tag status-partial">Partiel</span>
                                <?php endif; ?>
                            </td>
                            <td class="action-cell">
                                <?php if($data['sync_status'] === 'mismatch' || $data['sync_status'] === 'db_only'): ?>
                                    <form action="index.php?page=admin" method="POST" style="margin:0;">
                                        <input type="hidden" name="action" value="sync_single_admin">
                                        <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                        <button type="submit" class="action-btn-small new-btn">Synchroniser</button>
                                    </form>
                                <?php endif; ?>
                                <form action="index.php?page=admin" method="POST" style="margin:0;" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cet administrateur ?');">
                                    <input type="hidden" name="action" value="delete_admin">
                                    <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                    <button type="submit" class="action-btn-small delete-btn" <?= (str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?>>Supprimer</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <div class="card-footer">
                <h4>Changer un mot de passe</h4>
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="update_password">
                    <select name="username" class="inline-input">
                        <?php foreach($admins as $username => $data): if($data['in_db']): ?>
                            <option value="<?= htmlspecialchars($username) ?>"><?= htmlspecialchars($username) ?></option>
                        <?php endif; endforeach; ?>
                    </select>
                    <input type="password" name="password" required placeholder="Nouveau mot de passe" class="inline-input">
                    <button type="submit" class="action-btn-small save-btn">Mettre à jour</button>
                </form>
            </div>
        </div>

        <!-- Carte : Configuration BDD -->
        <div class="admin-card">
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

        <!-- Carte : Sauvegardes -->
        <div class="admin-card">
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
</div>
<?php require __DIR__ . '/partials/footer.php'; ?>
