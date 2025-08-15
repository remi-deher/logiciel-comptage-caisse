<?php require __DIR__ . '/partials/header.php'; ?>
<?php require __DIR__ . '/partials/navbar.php'; ?>
<div class="container">
    <div class="admin-header">
        <h2><i class="fa-solid fa-toolbox"></i>Panneau d'Administration</h2>
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
        <!-- NOUVELLE CARTE: Configuration des Retraits -->
        <div class="admin-card full-width-card">
            <h3><i class="fa-solid fa-sack-dollar"></i> Configuration des Retraits</h3>
            <div class="admin-card-content">
                <p>Définissez la quantité minimale de chaque dénomination à conserver dans la caisse lors d'une suggestion de retrait.</p>
                <form action="index.php?page=admin" method="POST">
                    <input type="hidden" name="action" value="update_withdrawal_config">
                    <div class="withdrawal-grid">
                        <div class="grid-column">
                            <h4>Billets</h4>
                            <div class="grid">
                                <?php foreach($denominations['billets'] as $name => $value): ?>
                                <div class="form-group">
                                    <label for="min_<?= $name ?>">Min. <?= $value ?> €</label>
                                    <input type="number" id="min_<?= $name ?>" name="min_to_keep[<?= $name ?>]" value="<?= htmlspecialchars($min_to_keep[$name] ?? 0) ?>" min="0" step="1">
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="grid-column">
                            <h4>Pièces</h4>
                            <div class="grid">
                                <?php foreach($denominations['pieces'] as $name => $value): ?>
                                <div class="form-group">
                                    <label for="min_<?= $name ?>">Min. <?= $value >= 1 ? $value.' €' : ($value*100).' cts' ?></label>
                                    <input type="number" id="min_<?= $name ?>" name="min_to_keep[<?= $name ?>]" value="<?= htmlspecialchars($min_to_keep[$name] ?? 0) ?>" min="0" step="1">
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <!-- NOUVEAU: Ajout de la classe 'mt-4' pour la marge -->
                    <button type="submit" class="save-btn mt-4"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
                </form>
            </div>
        </div>
        
        <!-- Carte : Configuration Générale -->
        <div class="admin-card">
            <h3><i class="fa-solid fa-sliders"></i>Configuration Générale</h3>
            <div class="admin-card-content">
                <form action="index.php?page=admin" method="POST">
                    <input type="hidden" name="action" value="update_app_config">
                    <div class="form-group">
                        <label for="app_timezone">Fuseau Horaire de l'Application</label>
                        <select id="app_timezone" name="app_timezone" class="inline-input">
                            <?php 
                            $current_timezone = defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris';
                            foreach($timezones as $timezone): ?>
                                <option value="<?= htmlspecialchars($timezone) ?>" <?= ($current_timezone === $timezone) ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($timezone) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <button type="submit" class="save-btn"><i class="fa-solid fa-floppy-disk"></i>Mettre à jour</button>
                </form>
            </div>
        </div>

        <!-- Carte : Gestion des Caisses -->
        <div class="admin-card">
            <h3><i class="fa-solid fa-cash-register"></i>Gestion des Caisses</h3>
            <div class="admin-card-content">
                <table class="admin-table">
                    <tbody>
                        <?php foreach($caisses as $id => $nom): ?>
                            <tr>
                                <td>
                                    <form action="index.php?page=admin" method="POST" class="inline-form">
                                        <input type="hidden" name="action" value="rename_caisse">
                                        <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                        <input type="text" name="caisse_name" value="<?= htmlspecialchars($nom) ?>" class="inline-input" aria-label="Nom de la caisse <?= $id ?>">
                                        <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-pencil"></i>Renommer</button>
                                    </form>
                                </td>
                                <td>
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('ATTENTION : La suppression d\'une caisse est irréversible et effacera toutes les données de comptage associées. Êtes-vous sûr ?');">
                                        <input type="hidden" name="action" value="delete_caisse">
                                        <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                        <button type="submit" class="action-btn-small delete-btn" <?= (str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?> title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="admin-card-footer">
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="add_caisse">
                    <input type="text" name="caisse_name" required placeholder="Nom de la nouvelle caisse" class="inline-input">
                    <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-plus"></i>Ajouter</button>
                </form>
            </div>
        </div>

        <!-- Carte : Sécurité & Accès -->
        <div class="admin-card">
            <h3><i class="fa-solid fa-shield-halved"></i>Sécurité & Accès</h3>
            <div class="admin-card-content">
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
                                        <form action="index.php?page=admin" method="POST" style="margin:0; display: inline-block;">
                                            <input type="hidden" name="action" value="sync_single_admin">
                                            <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                            <button type="submit" class="action-btn-small new-btn" title="Synchroniser"><i class="fa-solid fa-rotate"></i></button>
                                        </form>
                                    <?php endif; ?>
                                    <form action="index.php?page=admin" method="POST" style="margin:0; display: inline-block;" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cet administrateur ?');">
                                        <input type="hidden" name="action" value="delete_admin">
                                        <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                        <button type="submit" class="action-btn-small delete-btn" <?= (str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?> title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="admin-card-footer">
                <h4>Changer un mot de passe</h4>
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="update_password">
                    <select name="username" class="inline-input" aria-label="Sélectionner un utilisateur">
                        <?php foreach($admins as $username => $data): if($data['in_db']): ?>
                            <option value="<?= htmlspecialchars($username) ?>"><?= htmlspecialchars($username) ?></option>
                        <?php endif; endforeach; ?>
                    </select>
                    <input type="password" name="password" required placeholder="Nouveau mot de passe" class="inline-input">
                    <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-key"></i>Mettre à jour</button>
                </form>
            </div>
        </div>

        <!-- Carte : Maintenance -->
        <div class="admin-card">
            <h3><i class="fa-solid fa-database"></i>Maintenance</h3>
             <div class="admin-card-content">
                <h4>Sauvegardes de la Base de Données</h4>
                <p>Créez des sauvegardes régulières pour protéger vos données.</p>
                 <form action="index.php?page=admin" method="POST" style="margin-bottom: 20px;">
                    <input type="hidden" name="action" value="create_backup">
                    <button type="submit" class="new-btn" style="width:100%"><i class="fa-solid fa-download"></i>Créer une nouvelle sauvegarde</button>
                </form>
                
                <?php if (!empty($backups)): ?>
                    <ul class="backup-list">
                        <?php foreach($backups as $backup): ?>
                            <li>
                                <span><i class="fa-solid fa-file-zipper"></i> <?= htmlspecialchars($backup) ?></span>
                                <a href="index.php?page=admin&action=download_backup&file=<?= urlencode($backup) ?>" class="download-link"><i class="fa-solid fa-cloud-arrow-down"></i></a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php else: ?>
                    <p>Aucune sauvegarde trouvée.</p>
                <?php endif; ?>
            </div>
        </div>

        <!-- Carte : Configuration Technique -->
        <div class="admin-card">
            <h3><i class="fa-solid fa-sliders"></i>Configuration Technique</h3>
            <div class="admin-card-content">
                <form action="index.php?page=admin" method="POST">
                    <input type="hidden" name="action" value="update_db_config">
                    <div class="form-group"><label for="db_host">Hôte (IP/Domaine)</label><input id="db_host" type="text" name="db_host" value="<?= htmlspecialchars(DB_HOST) ?>"></div>
                    <div class="form-group"><label for="db_name">Nom de la base</label><input id="db_name" type="text" name="db_name" value="<?= htmlspecialchars(DB_NAME) ?>"></div>
                    <div class="form-group"><label for="db_user">Utilisateur</label><input id="db_user" type="text" name="db_user" value="<?= htmlspecialchars(DB_USER) ?>"></div>
                    <div class="form-group"><label for="db_pass">Mot de passe</label><input id="db_pass" type="password" name="db_pass" value="<?= htmlspecialchars(DB_PASS) ?>"></div>
                    <button type="submit" class="save-btn"><i class="fa-solid fa-floppy-disk"></i>Mettre à jour la configuration</button>
                </form>
            </div>
        </div>
    </div>
</div>
<?php require __DIR__ . '/partials/footer.php'; ?>
