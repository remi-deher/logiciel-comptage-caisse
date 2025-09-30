<?php
// src/Utils.php - Version améliorée pour des calculs plus détaillés et précis

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
        // --- CORRECTION : Passage aux calculs en centimes ---
        $total_compte_especes_cents = 0;
        if (isset($caisse_data['denominations'])) {
            foreach ($caisse_data['denominations'] as $denom) {
                $denomination_nom = $denom['denomination_nom'];
                $quantite = intval($denom['quantite']);
                $valeur_unitaire_euros = floatval($all_denoms_map[$denomination_nom] ?? 0);
                $total_compte_especes_cents += $quantite * round($valeur_unitaire_euros * 100);
            }
        }

        $total_compte_cb_cents = 0;
        if (isset($caisse_data['cb']) && is_array($caisse_data['cb'])) {
            foreach ($caisse_data['cb'] as $releves_pour_un_terminal) {
                if (is_array($releves_pour_un_terminal) && !empty($releves_pour_un_terminal)) {
                    $dernier_releve = end($releves_pour_un_terminal);
                    $total_compte_cb_cents += round(floatval($dernier_releve['montant'] ?? 0) * 100);
                }
            }
        }

        $total_compte_cheques_cents = 0;
        if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
            foreach($caisse_data['cheques'] as $cheque) {
                $total_compte_cheques_cents += round(floatval($cheque['montant'] ?? 0) * 100);
            }
        }

        $total_retraits_cents = 0;
        if (isset($caisse_data['retraits']) && is_array($caisse_data['retraits'])) {
            foreach($caisse_data['retraits'] as $denom => $qty) {
                $valeur_unitaire_euros = floatval($all_denoms_map[$denom] ?? 0);
                $total_retraits_cents += intval($qty) * round($valeur_unitaire_euros * 100);
            }
        }

        $fond_de_caisse_cents = round(floatval($caisse_data['fond_de_caisse'] ?? 0) * 100);
        $total_compte_global_cents = $total_compte_especes_cents + $total_compte_cb_cents + $total_compte_cheques_cents;
        $recette_reelle_totale_cents = $total_compte_global_cents - $fond_de_caisse_cents;

        $ventes_especes_cents = round(floatval($caisse_data['ventes_especes'] ?? 0) * 100);
        $ventes_cb_cents = round(floatval($caisse_data['ventes_cb'] ?? 0) * 100);
        $ventes_cheques_cents = round(floatval($caisse_data['ventes_cheques'] ?? 0) * 100);
        $retrocession_cents = round(floatval($caisse_data['retrocession'] ?? 0) * 100);
        $retrocession_cb_cents = round(floatval($caisse_data['retrocession_cb'] ?? 0) * 100);
        $retrocession_cheques_cents = round(floatval($caisse_data['retrocession_cheques'] ?? 0) * 100);
        $recette_theorique_totale_cents = $ventes_especes_cents + $ventes_cb_cents + $ventes_cheques_cents + $retrocession_cents + $retrocession_cb_cents + $retrocession_cheques_cents;

        $ecart_cents = $recette_reelle_totale_cents - $recette_theorique_totale_cents;
        
        // Reconversion en euros pour la sortie de la fonction
        $results['caisses'][$caisse_id] = [
            'total_compté' => $total_compte_global_cents / 100,
            'fond_de_caisse' => $fond_de_caisse_cents / 100,
            'ventes' => ($ventes_especes_cents + $ventes_cb_cents + $ventes_cheques_cents) / 100,
            'retrocession' => $retrocession_cents / 100,
            'retrocession_cb' => $retrocession_cb_cents / 100,
            'retrocession_cheques' => $retrocession_cheques_cents / 100,
            'recette_theorique' => $recette_theorique_totale_cents / 100,
            'recette_reelle' => $recette_reelle_totale_cents / 100,
            'ecart' => $ecart_cents / 100,
            'total_compte_especes' => $total_compte_especes_cents / 100,
            'total_compte_cb' => $total_compte_cb_cents / 100,
            'total_compte_cheques' => $total_compte_cheques_cents / 100,
            'total_retraits' => $total_retraits_cents / 100
        ];

        $results['combines']['total_compté'] += $total_compte_global_cents;
        $results['combines']['recette_reelle'] += $recette_reelle_totale_cents;
        $results['combines']['recette_theorique'] += $recette_theorique_totale_cents;
        $results['combines']['ecart'] += $ecart_cents;
    }
    
    // Reconversion finale pour les totaux combinés
    foreach($results['combines'] as &$value) {
        $value /= 100;
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
