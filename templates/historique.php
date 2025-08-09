<?php
// templates/historique.php

require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <h2>Historique des Comptages</h2>

    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <!-- Formulaire de filtrage -->
    <form action="index.php" method="GET" class="filter-form">
        <input type="hidden" name="page" value="historique">
        <div class="form-group">
            <label>Date de début</label>
            <input type="date" name="date_debut" value="<?= htmlspecialchars($date_debut) ?>">
        </div>
        <div class="form-group">
            <label>Date de fin</label>
            <input type="date" name="date_fin" value="<?= htmlspecialchars($date_fin) ?>">
        </div>
        <div class="form-group">
            <label>Recherche Nom</label>
            <input type="text" name="recherche" placeholder="..." value="<?= htmlspecialchars($recherche) ?>">
        </div>
        <div class="form-group">
            <label>Vue</label>
            <select name="vue_caisse">
                <option value="toutes" <?= $vue_caisse === 'toutes' ? 'selected' : '' ?>>Résumé Global</option>
                <?php foreach($this->noms_caisses as $num => $nom): ?>
                    <option value="caisse<?= $num ?>" <?= $vue_caisse === 'caisse'.$num ? 'selected' : '' ?>>Détails <?= htmlspecialchars($nom) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <button type="submit" class="new-btn" style="height:42px;">Filtrer</button>
        <a href="index.php?page=historique" style="text-decoration:none; height:42px; line-height:42px; padding: 0 15px;">Réinitialiser</a>
    </form>

    <div style="overflow-x:auto;">
        <?php if (empty($historique)): ?>
            <p>Aucun enregistrement trouvé pour ces critères.</p>
        <?php else: ?>
            <?php if ($vue_caisse === 'toutes'): // Vue Résumé Global ?>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Nom / Explication</th>
                            <th>Date</th>
                            <th>Total Global</th>
                            <?php foreach($this->noms_caisses as $nom): ?>
                                <th>Écart <?= htmlspecialchars($nom) ?></th>
                            <?php endforeach; ?>
                            <th>Écart Global</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($historique as $comptage):
                            $calculated = calculate_results_from_data($comptage, $this->nombre_caisses, $this->denominations);
                        ?>
                            <tr>
                                <td>
                                    <strong><?= htmlspecialchars($comptage['nom_comptage']) ?></strong>
                                    <?php if(!empty($comptage['explication'])): ?><small class="explication-text"><?= htmlspecialchars($comptage['explication']) ?></small><?php endif; ?>
                                </td>
                                <td><?= format_date_fr($comptage['date_comptage']) ?></td>
                                <td><?= format_euros($calculated['combines']['total_compté']) ?></td>
                                <?php foreach($this->noms_caisses as $num => $nom): 
                                    $ecart = $calculated['caisses'][$num]['ecart']; ?>
                                    <td class="<?= $ecart > 0.001 ? 'ecart-positif' : ($ecart < -0.001 ? 'ecart-negatif' : '') ?>"><?= format_euros($ecart) ?></td>
                                <?php endforeach; ?>
                                <td class="<?= $calculated['combines']['ecart'] > 0.001 ? 'ecart-positif' : ($calculated['combines']['ecart'] < -0.001 ? 'ecart-negatif' : '') ?>"><?= format_euros($calculated['combines']['ecart']) ?></td>
                                <td class="action-cell">
                                    <a href="index.php?page=calculateur&load=<?= $comptage['id'] ?>">Charger</a>
                                    <form method="POST" action="index.php?page=historique" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT ce comptage ?');">
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="id_a_supprimer" value="<?= $comptage['id'] ?>">
                                        <button type="submit" class="delete-btn">Supprimer</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: // Vue Détaillée pour une caisse
                $caisse_num = intval(substr($vue_caisse, 6)); // Extrait le numéro de "caisseX"
            ?>
                <h3>Détails pour la <?= htmlspecialchars($this->noms_caisses[$caisse_num]) ?></h3>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Nom/Date</th>
                            <th>FDC</th><th>Ventes</th><th>Rétro.</th>
                            <?php foreach($this->denominations['billets'] as $valeur) echo "<th>{$valeur}€</th>"; ?>
                            <?php foreach($this->denominations['pieces'] as $valeur) echo "<th>{$valeur}€</th>"; ?>
                            <th>Total Compté</th><th>Recette</th><th>Écart</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($historique as $comptage):
                            $calculated = calculate_results_from_data($comptage, $this->nombre_caisses, $this->denominations);
                            $caisse_data = $calculated['caisses'][$caisse_num];
                        ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($comptage['nom_comptage']) ?></strong><br><small><?= format_date_fr($comptage['date_comptage']) ?></small></td>
                                <td><?= format_euros($caisse_data['fond_de_caisse']) ?></td><td><?= format_euros($caisse_data['ventes']) ?></td><td><?= format_euros($caisse_data['retrocession']) ?></td>
                                <?php foreach($this->denominations['billets'] as $name => $val) echo "<td>" . (int)$comptage["c{$caisse_num}_{$name}"] . "</td>"; ?>
                                <?php foreach($this->denominations['pieces'] as $name => $val) echo "<td>" . (int)$comptage["c{$caisse_num}_{$name}"] . "</td>"; ?>
                                <td><?= format_euros($caisse_data['total_compté']) ?></td><td><?= format_euros($caisse_data['recette_reelle']) ?></td>
                                <td class="<?= $caisse_data['ecart'] > 0.001 ? 'ecart-positif' : ($caisse_data['ecart'] < -0.001 ? 'ecart-negatif' : '') ?>"><?= format_euros($caisse_data['ecart']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</div>

<?php
require 'partials/footer.php';
?>