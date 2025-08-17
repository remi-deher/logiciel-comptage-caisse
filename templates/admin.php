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
        <!-- NOUVELLE CARTE: Configuration des Dénominations -->
        <div class="admin-card full-width-card">
            <h3><i class="fa-solid fa-money-bill-wave"></i> Configuration des Dénominations et des Retraits</h3>
            <div class="admin-card-content">
                <p>Gérez la devise de votre caisse et définissez les dénominations et les quantités minimales à conserver.</p>

                <div class="form-group">
                    <label for="currency-selector">Sélectionner une devise prédéfinie</label>
                    <select id="currency-selector" class="inline-input">
                        <option value="EUR" selected>Euro (€)</option>
                        <option value="USD">Dollar Américain ($)</option>
                        <option value="JPY">Yen Japonais (¥)</option>
                        <option value="GBP">Livre Sterling (£)</option>
                        <option value="CHF">Franc Suisse (CHF)</option>
                        <option value="CAD">Dollar Canadien (CA$)</option>
                        <option value="AUD">Dollar Australien (AU$)</option>
                    </select>
                </div>

                <form id="denominations-form" action="index.php?page=admin" method="POST">
                    <input type="hidden" name="action" value="update_denominations_config">
                    <div class="withdrawal-grid">
                        <div class="grid-column">
                            <h4>Billets</h4>
                            <div id="billets-container">
                                <?php foreach($denominations['billets'] as $name => $value): ?>
                                <div class="form-group denomination-item">
                                    <label for="billet_<?= htmlspecialchars($name) ?>">Valeur</label>
                                    <input type="number" id="billet_<?= htmlspecialchars($name) ?>" name="denominations[billets][<?= htmlspecialchars($name) ?>]" value="<?= htmlspecialchars($value) ?>" min="1" step="1">
                                    <button type="button" class="action-btn-small delete-btn remove-denomination">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                                <?php endforeach; ?>
                            </div>
                            <button type="button" class="new-btn add-denomination" data-type="billets"><i class="fa-solid fa-plus"></i> Ajouter un billet</button>
                        </div>
                        <div class="grid-column">
                            <h4>Pièces</h4>
                            <div id="pieces-container">
                                <?php foreach($denominations['pieces'] as $name => $value): ?>
                                <div class="form-group denomination-item">
                                    <label for="piece_<?= htmlspecialchars($name) ?>">Valeur</label>
                                    <input type="number" id="piece_<?= htmlspecialchars($name) ?>" name="denominations[pieces][<?= htmlspecialchars($name) ?>]" value="<?= htmlspecialchars($value) ?>" min="0.01" step="0.01">
                                    <button type="button" class="action-btn-small delete-btn remove-denomination">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                                <?php endforeach; ?>
                            </div>
                            <button type="button" class="new-btn add-denomination" data-type="pieces"><i class="fa-solid fa-plus"></i> Ajouter une pièce</button>
                        </div>
                    </div>
                    <button type="submit" class="save-btn mt-4"><i class="fa-solid fa-floppy-disk"></i> Enregistrer les dénominations</button>
                </form>
            </div>
        </div>
        
        <!-- CARTE : Configuration des Retraits -->
        <div class="admin-card full-width-card">
            <h3><i class="fa-solid fa-sack-dollar"></i> Configuration des Retraits</h3>
            <div class="admin-card-content">
                <p>Définissez la quantité minimale de chaque dénomination à conserver dans la caisse lors d'une suggestion de retrait.</p>
                <form id="withdrawal-form" action="index.php?page=admin" method="POST">
                    <input type="hidden" name="action" value="update_withdrawal_config">
                    <div class="withdrawal-grid">
                        <div class="grid-column">
                            <h4>Billets</h4>
                            <div class="grid" id="min-billets-container">
                                <?php foreach($denominations['billets'] as $name => $value): ?>
                                <div class="form-group">
                                    <label for="min_<?= htmlspecialchars($name) ?>">Min. <?= htmlspecialchars($value) ?> €</label>
                                    <input type="number" id="min_<?= htmlspecialchars($name) ?>" name="min_to_keep[<?= htmlspecialchars($name) ?>]" value="<?= htmlspecialchars($min_to_keep[$name] ?? 0) ?>" min="0" step="1">
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="grid-column">
                            <h4>Pièces</h4>
                            <div class="grid" id="min-pieces-container">
                                <?php foreach($denominations['pieces'] as $name => $value): ?>
                                <div class="form-group">
                                    <label for="min_<?= htmlspecialchars($name) ?>">Min. <?= htmlspecialchars($value >= 1 ? $value.' €' : ($value*100).' cts') ?></label>
                                    <input type="number" id="min_<?= htmlspecialchars($name) ?>" name="min_to_keep[<?= htmlspecialchars($name) ?>]" value="<?= htmlspecialchars($min_to_keep[$name] ?? 0) ?>" min="0" step="1">
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
                                        <button type="submit" class="action-btn-small delete-btn" <?= (isset($_SESSION['admin_username']) && str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?> title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
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
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cet administrateur ?');">
                                        <input type="hidden" name="action" value="delete_admin">
                                        <input type="hidden" name="username" value="<?= htmlspecialchars($username) ?>">
                                        <button type="submit" class="action-btn-small delete-btn" <?= (isset($_SESSION['admin_username']) && str_starts_with($_SESSION['admin_username'], $username)) ? 'disabled' : '' ?> title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
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
                                <div class="action-buttons">
                                    <a href="index.php?page=admin&action=download_backup&file=<?= urlencode($backup) ?>" class="download-link"><i class="fa-solid fa-cloud-arrow-down"></i></a>
                                    <form action="index.php?page=admin" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer cette sauvegarde ?');" style="display:inline;">
                                        <input type="hidden" name="action" value="delete_backup">
                                        <input type="hidden" name="file" value="<?= htmlspecialchars($backup) ?>">
                                        <button type="submit" class="action-btn-small delete-btn"><i class="fa-solid fa-trash-can"></i></button>
                                    </form>
                                </div>
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

<script>
document.addEventListener('DOMContentLoaded', function () {
    const currencySelector = document.getElementById('currency-selector');
    const denominationsForm = document.getElementById('denominations-form');
    const withdrawalForm = document.getElementById('withdrawal-form');
    const billetsContainer = document.getElementById('billets-container');
    const piecesContainer = document.getElementById('pieces-container');
    const minBilletsContainer = document.getElementById('min-billets-container');
    const minPiecesContainer = document.getElementById('min-pieces-container');

    const currenciesData = {
        'EUR': {
            symbol: '€',
            billets: { 'b500': 500, 'b200': 200, 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5 },
            pieces: { 'p200': 2, 'p100': 1, 'p050': 0.50, 'p020': 0.20, 'p010': 0.10, 'p005': 0.05, 'p002': 0.02, 'p001': 0.01 },
            min_to_keep: { 'b5': 2, 'p200': 5, 'p100': 10 }
        },
        'USD': {
            symbol: '$',
            billets: { 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5, 'b2': 2, 'b1': 1 },
            pieces: { 'p100': 1, 'p050': 0.50, 'p025': 0.25, 'p010': 0.10, 'p005': 0.05, 'p001': 0.01 },
            min_to_keep: { 'b1': 5, 'b5': 5, 'p100': 20 }
        },
        'JPY': {
            symbol: '¥',
            billets: { 'b10000': 10000, 'b5000': 5000, 'b2000': 2000, 'b1000': 1000 },
            pieces: { 'p500': 500, 'p100': 100, 'p50': 50, 'p10': 10, 'p5': 5, 'p1': 1 },
            min_to_keep: { 'b1000': 10, 'p500': 10, 'p100': 20 }
        },
        'GBP': {
            symbol: '£',
            billets: { 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5 },
            pieces: { 'p200': 2, 'p100': 1, 'p050': 0.50, 'p020': 0.20, 'p010': 0.10, 'p005': 0.05, 'p002': 0.02, 'p001': 0.01 },
            min_to_keep: { 'b5': 5, 'p200': 5, 'p100': 10 }
        },
        'CHF': {
            symbol: 'CHF',
            billets: { 'b1000': 1000, 'b200': 200, 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10 },
            pieces: { 'p500': 5, 'p200': 2, 'p100': 1, 'p050': 0.50, 'p020': 0.20, 'p010': 0.10, 'p005': 0.05 },
            min_to_keep: { 'b10': 10, 'p500': 5 }
        },
        'CAD': {
            symbol: 'CA$',
            billets: { 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5 },
            pieces: { 'p200': 2, 'p100': 1, 'p025': 0.25, 'p010': 0.10, 'p005': 0.05, 'p001': 0.01 },
            min_to_keep: { 'b5': 5, 'p200': 5 }
        },
        'AUD': {
            symbol: 'AU$',
            billets: { 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5 },
            pieces: { 'p200': 2, 'p100': 1, 'p050': 0.50, 'p020': 0.20, 'p010': 0.10, 'p005': 0.05 },
            min_to_keep: { 'b5': 5, 'p200': 5, 'p100': 10 }
        }
    };
    
    // Fonction pour générer les champs de formulaire de dénominations
    function renderDenominations(currencyCode) {
        const currency = currenciesData[currencyCode];
        if (!currency) return;

        billetsContainer.innerHTML = '';
        minBilletsContainer.innerHTML = '';
        piecesContainer.innerHTML = '';
        minPiecesContainer.innerHTML = '';

        Object.entries(currency.billets).forEach(([name, value]) => {
            const billetItem = document.createElement('div');
            billetItem.className = 'form-group denomination-item';
            billetItem.innerHTML = `
                <label for="billet_${name}">Valeur</label>
                <input type="number" id="billet_${name}" name="denominations[billets][${name}]" value="${value}" min="1" step="1">
                <button type="button" class="action-btn-small delete-btn remove-denomination">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            billetsContainer.appendChild(billetItem);

            const minBilletItem = document.createElement('div');
            minBilletItem.className = 'form-group';
            const minBilletValue = currency.min_to_keep[name] || 0;
            minBilletItem.innerHTML = `
                <label for="min_${name}">Min. ${value} ${currency.symbol}</label>
                <input type="number" id="min_${name}" name="min_to_keep[${name}]" value="${minBilletValue}" min="0" step="1">
            `;
            minBilletsContainer.appendChild(minBilletItem);
        });

        Object.entries(currency.pieces).forEach(([name, value]) => {
            const pieceItem = document.createElement('div');
            pieceItem.className = 'form-group denomination-item';
            const label = value >= 1 ? `${value}` : `${value * 100} cts`;
            pieceItem.innerHTML = `
                <label for="piece_${name}">Valeur</label>
                <input type="number" id="piece_${name}" name="denominations[pieces][${name}]" value="${value}" min="0.01" step="0.01">
                <button type="button" class="action-btn-small delete-btn remove-denomination">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            piecesContainer.appendChild(pieceItem);
            
            const minPieceItem = document.createElement('div');
            minPieceItem.className = 'form-group';
            const minPieceValue = currency.min_to_keep[name] || 0;
            minPieceItem.innerHTML = `
                <label for="min_${name}">Min. ${label} ${currency.symbol}</label>
                <input type="number" id="min_${name}" name="min_to_keep[${name}]" value="${minPieceValue}" min="0" step="1">
            `;
            minPiecesContainer.appendChild(minPieceItem);
        });
    }

    // Événement pour ajouter dynamiquement un nouveau champ de dénomination
    document.querySelectorAll('.add-denomination').forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type; // 'billets' ou 'pieces'
            const container = document.getElementById(type + '-container');
            const uniqueId = 'new_' + Date.now();
            const labelText = (type === 'billets') ? 'Valeur' : 'Valeur';
            const stepValue = (type === 'billets') ? '1' : '0.01';
            const currentSymbol = currenciesData[currencySelector.value]?.symbol || '€';

            const newFieldHtml = `
                <div class="form-group denomination-item">
                    <label for="${type}_${uniqueId}">${labelText}</label>
                    <input type="number" id="${type}_${uniqueId}" name="denominations[${type}][${uniqueId}]" min="${stepValue}" step="${stepValue}">
                    <button type="button" class="action-btn-small delete-btn remove-denomination">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', newFieldHtml);
            
            const minContainer = (type === 'billets') ? minBilletsContainer : minPiecesContainer;
            const newMinFieldHtml = `
                <div class="form-group">
                    <label for="min_${uniqueId}">Min. <span class="denomination-value"></span> ${currentSymbol}</label>
                    <input type="number" id="min_${uniqueId}" name="min_to_keep[${uniqueId}]" value="0" min="0" step="1">
                </div>
            `;
            minContainer.insertAdjacentHTML('beforeend', newMinFieldHtml);
            
            const newDenominationInput = document.getElementById(`${type}_${uniqueId}`);
            const newMinLabel = document.querySelector(`label[for="min_${uniqueId}"]`);
            newDenominationInput.addEventListener('input', function() {
                const value = this.value;
                const labelText = (type === 'billets') ? `${value} ${currentSymbol}` : `${value >= 1 ? `${value} ${currentSymbol}` : `${value * 100} cts`}`;
                if(newMinLabel) newMinLabel.innerHTML = `Min. ${labelText}`;
            });
        });
    });

    // Événement pour supprimer dynamiquement un champ de dénomination
    document.addEventListener('click', function(event) {
        if (event.target.closest('.remove-denomination')) {
            const denominationItem = event.target.closest('.denomination-item');
            const inputId = denominationItem.querySelector('input').id;
            const uniqueId = inputId.split('_')[1];
            
            // Remove the main denomination item
            denominationItem.remove();

            // Find and remove the corresponding min_to_keep item
            const minItem = document.getElementById(`min_${uniqueId}`)?.closest('.form-group');
            if (minItem) {
                minItem.remove();
            }
        }
    });

    // Événement pour le sélecteur de devise
    if (currencySelector) {
        currencySelector.addEventListener('change', (event) => {
            renderDenominations(event.target.value);
        });
    }
    
    // Initialisation avec la devise par défaut
    // J'ai enlevé l'appel ici pour que l'initialisation se fasse via PHP pour les valeurs par défaut
    // et que le JS ne prenne le relais qu'au changement.

    // Correction: On initialise le formulaire min_to_keep en se basant sur les dénominations de la page
    const denominationsFromPage = {
        billets: {},
        pieces: {}
    };
    document.querySelectorAll('#billets-container .denomination-item input').forEach(input => {
        const name = input.id.split('_')[1];
        denominationsFromPage.billets[name] = parseFloat(input.value);
    });
    document.querySelectorAll('#pieces-container .denomination-item input').forEach(input => {
        const name = input.id.split('_')[1];
        denominationsFromPage.pieces[name] = parseFloat(input.value);
    });

    // On s'assure que les labels de min_to_keep sont corrects au chargement
    function updateMinToKeepLabels() {
        const currentDenominations = denominationsFromPage;
        const currentSymbol = '€'; // On suppose que la page est chargée avec l'euro par défaut

        Object.entries(currentDenominations.billets).forEach(([name, value]) => {
            const labelEl = document.querySelector(`label[for="min_${name}"]`);
            if (labelEl) {
                labelEl.innerHTML = `Min. ${value} ${currentSymbol}`;
            }
        });

        Object.entries(currentDenominations.pieces).forEach(([name, value]) => {
            const labelEl = document.querySelector(`label[for="min_${name}"]`);
            if (labelEl) {
                const labelText = value >= 1 ? `${value} ${currentSymbol}` : `${value * 100} cts`;
                labelEl.innerHTML = `Min. ${labelText}`;
            }
        });
    }
    updateMinToKeepLabels();
});
</script>

<?php require __DIR__ . '/partials/footer.php'; ?>
