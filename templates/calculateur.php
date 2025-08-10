<?php
// templates/calculateur.php

// On injecte les variables PHP nécessaires au JavaScript, uniquement sur cette page.
if (isset($page_css) && $page_css === 'calculateur.css') {
    echo "<script>\n";
    echo "    const nombreCaisses = " . ($nombre_caisses ?? 0) . ";\n";
    echo "    const nomsCaisses = " . json_encode($noms_caisses) . ";\n";
    echo "    const denominations = " . json_encode($denominations) . ";\n";
    echo "</script>\n";
}

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
            <?php $is_first = true; ?>
            <?php foreach ($noms_caisses as $id => $nom): ?>
                <button type="button" class="tab-link <?= $is_first ? 'active' : '' ?>" data-tab="caisse<?= $id ?>"><?= htmlspecialchars($nom) ?></button>
                <?php $is_first = false; ?>
            <?php endforeach; ?>
        </div>

        <!-- Affichage de l'écart de la caisse active -->
        <div class="ecart-display-container">
            <?php $is_first = true; ?>
            <?php foreach ($noms_caisses as $id => $nom): ?>
                <div id="ecart-display-caisse<?= $id ?>" class="ecart-display <?= $is_first ? 'active' : '' ?>">
                    Écart Caisse Actuelle : <span class="ecart-value">0,00 €</span>
                    <p class="ecart-explanation"></p> 
                    <p class="ecart-explanation-total"></p>
                </div>
                <?php $is_first = false; ?>
            <?php endforeach; ?>
        </div>

        <!-- Contenu pour chaque caisse -->
        <?php $is_first = true; ?>
        <?php foreach ($noms_caisses as $id => $nom): ?>
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
                            <label>Valeur des Ventes (€)</label>
                            <input type="text" id="ventes_<?= $id ?>" name="caisse[<?= $id ?>][ventes]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$id}_ventes"] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label>Valeur des Rétrocessions (€)</label>
                            <input type="text" id="retrocession_<?= $id ?>" name="caisse[<?= $id ?>][retrocession]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data["c{$id}_retrocession"] ?? '') ?>">
                        </div>
                    </div>

                    <h3>Détail des Billets</h3>
                    <div class="grid">
                        <?php foreach($denominations['billets'] as $name => $valeur): ?>
                        <div class="form-group">
                            <label><?= $valeur ?> €</label>
                            <input type="number" id="<?= $name ?>_<?= $id ?>" name="caisse[<?= $id ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data["c{$id}_{$name}"] ?? '') ?>">
                        </div>
                        <?php endforeach; ?>
                    </div>

                    <h3>Détail des Pièces</h3>
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
            <?php $is_first = false; ?>
        <?php endforeach; ?>

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
                <div id="autosave-status" class="autosave-status"></div>
            </div>
        </div>
    </form>

    <!-- Section où les résultats en temps réel seront affichés par JavaScript -->
    <div class="results" id="results-container">
        <h2>Résultats en Temps Réel</h2>
        <div class="results-grid">
            <?php foreach ($noms_caisses as $id => $nom): ?>
            <div class="result-box">
                <h3><?= htmlspecialchars($nom) ?></h3>
                <p><span>Fond de caisse :</span> <span id="res-c<?= $id ?>-fdc">0,00 €</span></p>
                <p class="total"><span>Total compté :</span> <span id="res-c<?= $id ?>-total">0,00 €</span></p>
                <hr>
                <p><span>Recette théorique :</span> <span id="res-c<?= $id ?>-theorique">0,00 €</span></p>
                <p class="total"><span>Recette réelle :</span> <span id="res-c<?= $id ?>-recette">0,00 €</span></p>
                <p class="total"><span>Écart :</span> <span id="res-c<?= $id ?>-ecart">0,00 €</span></p>
            </div>
            <?php endforeach; ?>
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
