<?php
// templates/calculateur.php

$page_js = 'calculator.js'; // Définit le script JS spécifique à cette page

require 'partials/header.php';
require 'partials/navbar.php';

// On prépare les données pour les passer au JavaScript de manière sécurisée
$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? []
]);
?>

<!-- Ce div invisible contient les données de configuration pour le JavaScript -->
<div id="calculator-data" data-config='<?= htmlspecialchars($config_data, ENT_QUOTES, 'UTF-8') ?>'></div>

<div class="container">
    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form id="caisse-form" action="index.php?page=calculateur" method="post">
        <input type="hidden" name="action" value="save">

        <div class="tab-selector">
            <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
                <button type="button" class="tab-link <?= $is_first ? 'active' : '' ?>" data-tab="caisse<?= $id ?>"><?= htmlspecialchars($nom) ?></button>
                <?php $is_first = false; endforeach; ?>
        </div>

        <div class="ecart-display-container">
            <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
                <div id="ecart-display-caisse<?= $id ?>" class="ecart-display <?= $is_first ? 'active' : '' ?>">
                    Écart Caisse Actuelle : <span class="ecart-value">0,00 €</span>
                    <p class="ecart-explanation"></p> 
                </div>
                <?php $is_first = false; endforeach; ?>
        </div>

        <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
            <div id="caisse<?= $id ?>" class="tab-content <?= $is_first ? 'active' : '' ?>">
                <fieldset>
                    <legend>Saisie pour la <?= htmlspecialchars($nom) ?></legend>
                    
                    <h3>Informations Initiales</h3>
                    <div class="grid grid-3">
                        <div class="form-group">
                            <label>Fond de Caisse (€)</label>
                            <input type="text" id="fond_de_caisse_<?= $id ?>" name="caisse[<?= $id ?>][fond_de_caisse]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$id}_fond_de_caisse"] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label>Total Ventes du Jour (€)</label>
                            <input type="text" id="ventes_<?= $id ?>" name="caisse[<?= $id ?>][ventes]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$id}_ventes"] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label>Rétrocessions / Prélèvements (€)</label>
                            <input type="text" id="retrocession_<?= $id ?>" name="caisse[<?= $id ?>][retrocession]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$id}_retrocession"] ?? '') ?>">
                        </div>
                    </div>

                    <h3>Détail des Espèces</h3>
                    <h4>Billets</h4>
                    <div class="grid">
                        <?php foreach($denominations['billets'] as $name => $valeur): ?>
                        <div class="form-group">
                            <label><?= $valeur ?> €</label>
                            <input type="number" id="<?= $name ?>_<?= $id ?>" name="caisse[<?= $id ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data["c{$id}_{$name}"] ?? '') ?>">
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <h4>Pièces</h4>
                    <div class="grid">
                        <?php foreach($denominations['pieces'] as $name => $valeur): ?>
                        <div class="form-group">
                            <label><?= $valeur >= 1 ? $valeur.' €' : ($valeur*100).' cts' ?></label>
                            <input type="number" id="<?= $name ?>_<?= $id ?>" name="caisse[<?= $id ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data["c{$id}_{$name}"] ?? '') ?>">
                        </div>
                        <?php endforeach; ?>
                    </div>
                </fieldset>
            </div>
            <?php $is_first = false; endforeach; ?>

        <div class="save-section">
            <h3>Enregistrer le comptage</h3>
            <div class="form-group">
                <label for="nom_comptage">Donnez un nom à ce comptage</label>
                <input type="text" id="nom_comptage" name="nom_comptage" required value="<?= htmlspecialchars($loaded_data['nom_comptage'] ?? '') ?>">
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label for="explication">Explication (optionnel)</label>
                <textarea id="explication" name="explication" rows="3" placeholder="Ex: jour de marché, erreur de rendu monnaie, etc."><?= htmlspecialchars($loaded_data['explication'] ?? '') ?></textarea>
            </div>
            <div class="button-group">
                <button type="submit" class="save-btn">Enregistrer le Comptage</button>
                <div id="autosave-status" class="autosave-status"></div>
            </div>
        </div>
    </form>

    <div class="results" id="results-container">
        <h2>Synthèse en Temps Réel</h2>
        <div class="results-grid">
            <?php foreach ($noms_caisses as $id => $nom): ?>
            <div class="result-box">
                <h3><?= htmlspecialchars($nom) ?></h3>
                <div class="result-line"><span>Fond de caisse :</span> <span id="res-c<?= $id ?>-fdc">0,00 €</span></div>
                <div class="result-line total"><span>Total compté :</span> <span id="res-c<?= $id ?>-total">0,00 €</span></div>
                <hr>
                <div class="result-line"><span>Recette théorique :</span> <span id="res-c<?= $id ?>-theorique">0,00 €</span></div>
                <div class="result-line total"><span>Recette réelle :</span> <span id="res-c<?= $id ?>-recette">0,00 €</span></div>
                <div class="result-line total"><span>ÉCART :</span> <span id="res-c<?= $id ?>-ecart">0,00 €</span></div>
            </div>
            <?php endforeach; ?>
        </div>
        <div class="result-box combined-results">
            <h3>Totaux Combinés</h3>
            <div class="result-line"><span>Total Fonds de caisse :</span> <span id="res-total-fdc">0,00 €</span></div>
            <div class="result-line"><span>Total compté (global) :</span> <span id="res-total-total">0,00 €</span></div>
            <hr>
            <div class="result-line"><span>Recette théorique totale :</span> <span id="res-total-theorique">0,00 €</span></div>
            <div class="result-line total"><span>Recette réelle totale :</span> <span id="res-total-recette">0,00 €</span></div>
            <div class="result-line total"><span>ÉCART TOTAL :</span> <span id="res-total-ecart">0,00 €</span></div>
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
