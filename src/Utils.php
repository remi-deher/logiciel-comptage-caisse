<?php
// src/Utils.php - Version améliorée pour des calculs plus détaillés

function calculate_results_from_data($data_rows) {
    $results = [
        'caisses' => [], 
        'combines' => [
            'total_compté' => 0, 
            'recette_reelle' => 0, 
            'ecart' => 0, 
            'recette_theorique' => 0
        ]
    ];
    
    global $denominations;
    if (!isset($denominations)) $denominations = [];

    $all_denoms_map = ($denominations['billets'] ?? []) + ($denominations['pieces'] ?? []);

    foreach ($data_rows as $caisse_id => $caisse_data) {
        $total_compte_especes = 0;
        if (isset($caisse_data['denominations'])) {
            foreach ($caisse_data['denominations'] as $denom) {
                $denomination_nom = $denom['denomination_nom'];
                $quantite = floatval($denom['quantite']);
                $valeur_unitaire = floatval($all_denoms_map[$denomination_nom] ?? 0);
                $total_compte_especes += $quantite * $valeur_unitaire;
            }
        }

        $total_compte_cb = 0;
        if (isset($caisse_data['cb']) && is_array($caisse_data['cb'])) {
            // $releves_par_terminal est un tableau groupant les relevés par ID de terminal.
            // Ex: [ '1' => [releveA, releveB], '2' => [releveC] ]
            foreach ($caisse_data['cb'] as $releves_par_terminal) {
                if (is_array($releves_par_terminal) && !empty($releves_par_terminal)) {
                    // Les relevés sont déjà triés par heure grâce à la requête SQL.
                    // On récupère donc simplement le dernier élément du tableau.
                    $dernier_releve = end($releves_par_terminal);
                    $total_compte_cb += floatval($dernier_releve['montant'] ?? 0);
                }
            }
        }

        $total_compte_cheques = 0;
        if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
            foreach($caisse_data['cheques'] as $cheque) {
                $total_compte_cheques += floatval($cheque['montant'] ?? 0);
            }
        }

        // NOUVEAU : Calcul du total des retraits
        $total_retraits = 0;
        if (isset($caisse_data['retraits']) && is_array($caisse_data['retraits'])) {
            foreach($caisse_data['retraits'] as $denom => $qty) {
                $valeur_unitaire = floatval($all_denoms_map[$denom] ?? 0);
                $total_retraits += intval($qty) * $valeur_unitaire;
            }
        }

        $fond_de_caisse = floatval($caisse_data['fond_de_caisse'] ?? 0);
        $total_compte_global = $total_compte_especes + $total_compte_cb + $total_compte_cheques;
        $recette_reelle_totale = $total_compte_global - $fond_de_caisse;

        $ventes_especes = floatval($caisse_data['ventes_especes'] ?? 0);
        $ventes_cb = floatval($caisse_data['ventes_cb'] ?? 0);
        $ventes_cheques = floatval($caisse_data['ventes_cheques'] ?? 0);
        $retrocession = floatval($caisse_data['retrocession'] ?? 0);
        $recette_theorique_totale = $ventes_especes + $ventes_cb + $ventes_cheques + $retrocession;

        $ecart = $recette_reelle_totale - $recette_theorique_totale;
        
        // AMÉLIORATION : On ajoute les totaux détaillés au tableau de résultats
        $results['caisses'][$caisse_id] = [
            'total_compté' => $total_compte_global,
            'fond_de_caisse' => $fond_de_caisse,
            'ventes' => $ventes_especes + $ventes_cb + $ventes_cheques,
            'retrocession' => $retrocession,
            'recette_theorique' => $recette_theorique_totale,
            'recette_reelle' => $recette_reelle_totale,
            'ecart' => $ecart,
            // --- AJOUTS ---
            'total_compte_especes' => $total_compte_especes,
            'total_compte_cb' => $total_compte_cb,
            'total_compte_cheques' => $total_compte_cheques,
            'total_retraits' => $total_retraits
            // --- FIN DES AJOUTS ---
        ];

        $results['combines']['total_compté'] += $total_compte_global;
        $results['combines']['recette_reelle'] += $recette_reelle_totale;
        $results['combines']['recette_theorique'] += $recette_theorique_totale;
        $results['combines']['ecart'] += $ecart;
    }
    
    return $results;
}

function get_numeric_value($source_array, $key) {
    if (!isset($source_array[$key]) || $source_array[$key] === '') return 0;
    return floatval(str_replace(',', '.', $source_array[$key]));
}

function format_currency($montant) {
    $symbol = defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€';
    return number_format($montant, 2, ',', ' ') . ' ' . $symbol;
}

function format_date_fr($date_string) {
    if (class_exists('IntlDateFormatter')) {
        $date = new DateTime($date_string);
        $formatter = new IntlDateFormatter('fr_FR', IntlDateFormatter::FULL, IntlDateFormatter::SHORT, null, null, 'eeee d MMMM yyyy, HH:mm');
        return $formatter->format($date);
    } else {
        $days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        $months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        $timestamp = strtotime($date_string);
        if ($timestamp === false) return $date_string;
        $dayOfWeek = $days[date('w', $timestamp)];
        $dayOfMonth = date('j', $timestamp);
        $month = $months[date('n', $timestamp) - 1];
        $year = date('Y', $timestamp);
        $time = date('H:i', $timestamp);
        return ucfirst($dayOfWeek) . ' ' . $dayOfMonth . ' ' . $month . ' ' . $year . ' à ' . $time;
    }
}
