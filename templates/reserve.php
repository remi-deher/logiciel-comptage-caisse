<?php
// templates/reserve.php
require 'partials/header.php';
require 'partials/navbar.php';

$currency_symbol = defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€';

$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? [],
    'currencySymbol' => $currency_symbol,
    'isAdmin' => !empty($_SESSION['is_admin'])
]);
?>

<div id="reserve-data" data-config='<?= htmlspecialchars($config_data, ENT_QUOTES, 'UTF-8') ?>'></div>

<div class="container" id="reserve-page">

    <section id="reserve-status-section" class="reserve-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-vault"></i> État de la Réserve</h2>
            <div id="reserve-total-value" class="total-value-display">Chargement...</div>
        </div>
        <div id="reserve-denominations-grid" class="denominations-grid">
            </div>
    </section>

    <div class="interaction-panel">

        <section id="demandes-section" class="reserve-section">
            <div class="section-header">
                <h3><i class="fa-solid fa-right-left"></i> Demandes & Traitement</h3>
                <button id="show-demande-form-btn" class="btn new-btn"><i class="fa-solid fa-plus"></i> Nouvelle Demande</button>
            </div>

            <form id="new-demande-form" class="card hidden">
                <h4>Faire une nouvelle demande</h4>
                <div class="form-group">
                    <label for="demande-caisse-id">Pour la caisse</label>
                    <select id="demande-caisse-id" name="caisse_id" required>
                        <?php foreach($noms_caisses as $id => $nom): ?>
                            <option value="<?= $id ?>"><?= htmlspecialchars($nom) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="demande-denomination">J'ai besoin de</label>
                    <select id="demande-denomination" name="denomination_demandee" required></select>
                </div>
                <div class="form-group">
                    <label for="demande-quantite">Quantité</label>
                    <input type="number" id="demande-quantite" name="quantite_demandee" min="1" required>
                </div>
                <div class="value-display">Total demandé: <span id="demande-valeur">0,00 <?= $currency_symbol ?></span></div>
                <div class="form-group">
                    <label for="demande-notes">Notes (optionnel)</label>
                    <textarea id="demande-notes" name="notes_demandeur" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" id="cancel-demande-btn" class="btn delete-btn">Annuler</button>
                    <button type="submit" class="btn save-btn">Envoyer</button>
                </div>
            </form>

            <div id="demandes-en-attente-list">
                </div>
        </section>

        <section id="historique-section" class="reserve-section">
             <div class="section-header">
                <h3><i class="fa-solid fa-timeline"></i> Derniers Mouvements</h3>
            </div>
            <div id="historique-list">
                </div>
        </section>
    </div>
</div>

<?php require 'partials/footer.php'; ?>
