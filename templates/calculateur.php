<?php
// templates/calculateur.php

require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form id="caisse-form" action="index.php?page=calculateur" method="post">
        <input type="hidden" name="action" value="save">

        <!-- Sélecteur d'onglets pour naviguer entre les caisses -->
        <div class="tab-selector">
            <?php for ($i = 1; $i <= $nombre_caisses; $i++): ?>
                <button type="button" class="tab-link <?= $i === 1 ? 'active' : '' ?>" data-tab="caisse<?= $i ?>"><?= htmlspecialchars($noms_caisses[$i]) ?></button>
            <?php endfor; ?>
        </div>

        <!-- Affichage de l'écart de la caisse active -->
        <div class="ecart-display-container">
            <?php for ($i = 1; $i <= $nombre_caisses; $i++): ?>
                <div id="ecart-display-caisse<?= $i ?>" class="ecart-display <?= $i === 1 ? 'active' : '' ?>">
                    Écart Caisse Actuelle : <span class="ecart-value">0,00 €</span>
                    <p class="ecart-explanation"></p> 
                    <!-- NOUVEL ÉLÉMENT -->
                    <p class="ecart-explanation-total"></p>
                </div>
            <?php endfor; ?>
        </div>

        <!-- Contenu pour chaque caisse -->
        <?php for ($i = 1; $i <= $nombre_caisses; $i++): ?>
            <div id="caisse<?= $i ?>" class="tab-content <?= $i === 1 ? 'active' : '' ?>">
                <fieldset>
                    <legend>Saisie pour la <?= htmlspecialchars($noms_caisses[$i]) ?></legend>
                    
                    <h3>Informations Initiales</h3>
                    <div class="grid grid-3">
                        <div class="form-group">
                            <label>Fond de Caisse (€)</label>
                            <input type="text" id="fond_de_caisse_<?= $i ?>" name="caisse[<?= $i ?>][fond_de_caisse]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$i}_fond_de_caisse"] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label>Valeur des Ventes (€)</label>
                            <input type="text" id="ventes_<?= $i ?>" name="caisse[<?= $i ?>][ventes]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$i}_ventes"] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label>Valeur des Rétrocessions (€)</label>
                            <input type="text" id="retrocession_<?= $i ?>" name="caisse[<?= $i ?>][retrocession]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$i}_retrocession"] ?? '') ?>">
                        </div>
                    </div>

                    <h3>Détail des Billets</h3>
                    <div class="grid">
                        <?php foreach($denominations['billets'] as $name => $valeur): ?>
                        <div class="form-group">
                            <label><?= $valeur ?> €</label>
                            <input type="number" id="<?= $name ?>_<?= $i ?>" name="caisse[<?= $i ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data["c{$i}_{$name}"] ?? '') ?>">
                        </div>
                        <?php endforeach; ?>
                    </div>

                    <h3>Détail des Pièces</h3>
                    <div class="grid">
                        <?php foreach($denominations['pieces'] as $name => $valeur): ?>
                        <div class="form-group">
                            <label><?= $valeur >= 1 ? $valeur.' €' : ($valeur*100).' cts' ?></label>
                            <input type="number" id="<?= $name ?>_<?= $i ?>" name="caisse[<?= $i ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data["c{$i}_{$name}"] ?? '') ?>">
                        </div>
                        <?php endforeach; ?>
                    </div>
                </fieldset>
            </div>
        <?php endfor; ?>

        <!-- Section pour la sauvegarde -->
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
            </div>
        </div>
    </form>

    <!-- Section où les résultats en temps réel seront affichés par JavaScript -->
    <div class="results" id="results-container">
        <h2>Résultats en Temps Réel</h2>
        <div class="results-grid">
            <?php for ($i = 1; $i <= $nombre_caisses; $i++): ?>
            <div class="result-box">
                <h3><?= htmlspecialchars($noms_caisses[$i]) ?></h3>
                <p><span>Fond de caisse :</span> <span id="res-c<?= $i ?>-fdc">0,00 €</span></p>
                <p class="total"><span>Total compté :</span> <span id="res-c<?= $i ?>-total">0,00 €</span></p>
                <hr>
                <p><span>Recette théorique :</span> <span id="res-c<?= $i ?>-theorique">0,00 €</span></p>
                <p class="total"><span>Recette réelle :</span> <span id="res-c<?= $i ?>-recette">0,00 €</span></p>
                <p class="total"><span>Écart :</span> <span id="res-c<?= $i ?>-ecart">0,00 €</span></p>
            </div>
            <?php endfor; ?>
        </div>
        <div class="result-box combined-results">
            <h3>Totaux Combinés</h3>
            <p><span>Total compté (global) :</span> <span id="res-total-total">0,00 €</span></p>
            <hr>
            <p><span>Recette théorique totale :</span> <span id="res-total-theorique">0,00 €</span></p>
            <p class="total"><span>Recette réelle totale :</span> <span id="res-total-recette">0,00 €</span></p>
            <p class="total"><span>Écart total :</span> <span id="res-total-ecart">0,00 €</span></p>
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
