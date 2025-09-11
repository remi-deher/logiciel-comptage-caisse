<?php
// src/Utils.php - Version mise à jour pour le schéma normalisé.

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

    foreach ($data_rows as $caisse_id => $caisse_data) {
        $total_compte = 0;
        
        if (isset($caisse_data['denominations'])) {
            foreach ($caisse_data['denominations'] as $denom) {
                $valeur = 0;
                foreach ($denominations as $list) {
                    if (isset($list[$denom['denomination_nom']])) {
                        $valeur = floatval($list[$denom['denomination_nom']]);
                        break;
                    }
                }
                $total_compte += floatval($denom['quantite']) * $valeur;
            }
        }

        $fond_de_caisse = floatval($caisse_data['fond_de_caisse'] ?? 0);
        
        // --- DÉBUT DU BLOC CORRIGÉ ---
        // On inclut maintenant TOUS les types de ventes dans le calcul
        $ventes_especes = floatval($caisse_data['ventes_especes'] ?? 0);
        $ventes_cb = floatval($caisse_data['ventes_cb'] ?? 0);
        $ventes_cheques = floatval($caisse_data['ventes_cheques'] ?? 0);
        $ventes_totales = $ventes_especes + $ventes_cb + $ventes_cheques;
        // --- FIN DU BLOC CORRIGÉ ---

        $retrocession = floatval($caisse_data['retrocession'] ?? 0);
        
        // Le calcul de la recette théorique prend maintenant en compte le total des ventes
        $recette_theorique = $ventes_totales + $retrocession;
        $recette_reelle = $total_compte - $fond_de_caisse;
        $ecart = $recette_reelle - $ventes_especes - $retrocession;
        
        $results['caisses'][$caisse_id] = compact('total_compte', 'fond_de_caisse', 'ventes_totales', 'retrocession', 'recette_theorique', 'recette_reelle', 'ecart');
        
        // Mise à jour des totaux combinés
        $results['combines']['total_compté'] += $total_compte;
        $results['combines']['recette_reelle'] += $recette_reelle;
        $results['combines']['recette_theorique'] += $recette_theorique;
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
