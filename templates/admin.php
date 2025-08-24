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
        <div class="admin-card">
            <h3><i class="fa-solid fa-cash-register"></i>Gestion des Caisses</h3>
            <div class="admin-card-content">
                <table class="admin-table">
                    <tbody>
                        <?php foreach($caisses as $id => $nom): ?>
                            <tr>
                                <td data-label="Nom">
                                    <form action="index.php?page=admin" method="POST" class="inline-form">
                                        <input type="hidden" name="action" value="rename_caisse">
                                        <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                        <input type="text" name="caisse_name" value="<?= htmlspecialchars($nom) ?>" class="inline-input" aria-label="Nom de la caisse <?= $id ?>">
                                        <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-pencil"></i>Modifier</button>
                                    </form>
                                </td>
                                <td data-label="Actions">
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cette caisse ?');">
                                        <input type="hidden" name="action" value="delete_caisse">
                                        <input type="hidden" name="caisse_id" value="<?= $id ?>">
                                        <button type="submit" class="action-btn-small delete-btn" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
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
        
        <div class="admin-card">
            <h3><i class="fa-solid fa-credit-card"></i>Gestion des Terminaux de Paiement</h3>
            <div class="admin-card-content">
                <table class="admin-table">
                    <tbody>
                        <?php foreach($terminaux as $terminal): ?>
                            <tr>
                                <td data-label="Nom">
                                    <form action="index.php?page=admin" method="POST" class="inline-form">
                                        <input type="hidden" name="action" value="rename_terminal">
                                        <input type="hidden" name="terminal_id" value="<?= $terminal['id'] ?>">
                                        <input type="text" name="terminal_name" value="<?= htmlspecialchars($terminal['nom_terminal']) ?>" class="inline-input" aria-label="Nom du terminal <?= $terminal['id'] ?>">
                                        <select name="caisse_associee" class="inline-input">
                                            <?php foreach($caisses as $id => $nom): ?>
                                                <option value="<?= $id ?>" <?= ($terminal['caisse_associee'] == $id) ? 'selected' : '' ?>><?= htmlspecialchars($nom) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                        <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-pencil"></i>Modifier</button>
                                    </form>
                                </td>
                                <td data-label="Actions">
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer ce terminal ?');">
                                        <input type="hidden" name="action" value="delete_terminal">
                                        <input type="hidden" name="terminal_id" value="<?= $terminal['id'] ?>">
                                        <button type="submit" class="action-btn-small delete-btn" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="admin-card-footer">
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="add_terminal">
                    <input type="text" name="terminal_name" required placeholder="Nom du nouveau terminal" class="inline-input">
                     <select name="caisse_associee" class="inline-input">
                        <?php foreach($caisses as $id => $nom): ?>
                            <option value="<?= $id ?>"><?= htmlspecialchars($nom) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-plus"></i>Ajouter</button>
                </form>
            </div>
        </div>

        <div class="admin-card">
            <h3><i class="fa-solid fa-users-cog"></i>Gestion des Administrateurs</h3>
            <div class="admin-card-content">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nom d'utilisateur</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach($admins as $admin): ?>
                            <tr>
                                <td data-label="Nom d'utilisateur"><?= htmlspecialchars($admin['username']) ?></td>
                                <td data-label="Actions">
                                    <form action="index.php?page=admin" method="POST" class="inline-form">
                                        <input type="hidden" name="action" value="update_password">
                                        <input type="hidden" name="username" value="<?= htmlspecialchars($admin['username']) ?>">
                                        <input type="password" name="password" placeholder="Nouveau mot de passe" required class="inline-input">
                                        <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-key"></i>Modifier</button>
                                    </form>
                                    <?php if (count($admins) > 1): ?>
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('Êtes-vous sûr ?');">
                                        <input type="hidden" name="action" value="delete_admin">
                                        <input type="hidden" name="username" value="<?= htmlspecialchars($admin['username']) ?>">
                                        <button type="submit" class="action-btn-small delete-btn" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
                                    </form>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="admin-card-footer">
                <form action="index.php?page=admin" method="POST" class="inline-form">
                    <input type="hidden" name="action" value="sync_single_admin">
                    <input type="text" name="username" required placeholder="Nom d'utilisateur à ajouter/synchroniser" class="inline-input">
                    <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-sync"></i>Ajouter / Synchro</button>
                </form>
            </div>
        </div>
    </div>
</div>
<?php require __DIR__ . '/partials/footer.php'; ?>
