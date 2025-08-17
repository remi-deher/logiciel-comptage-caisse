<?php
// src/Utils.php - Version mise à jour pour le schéma normalisé.

/**
 * Calcule tous les totaux pour les caisses et les totaux combinés à partir d'un tableau de données.
 * Cette fonction est maintenant capable de gérer une structure de données normalisée.
 *
 * @param array $data_rows Les données des comptages provenant de la BDD.
 * @return array Un tableau structuré avec les résultats.
 */
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
    
    // On s'assure que la variable globale existe
    global $denominations;
    if (!isset($denominations)) {
        $denominations = [];
    }

    foreach ($data_rows as $caisse_id => $caisse_data) {
        $total_compte = 0;
        
        // On recalcule le total compté en utilisant les dénominations
        foreach ($caisse_data['denominations'] as $denom) {
            $valeur = 0;
            // Recherche de la valeur de la dénomination
            foreach ($denominations as $list) {
                if (isset($list[$denom['denomination_nom']])) {
                    $valeur = floatval($list[$denom['denomination_nom']]);
                    break;
                }
            }
            $total_compte += floatval($denom['quantite']) * $valeur;
        }

        $fond_de_caisse = floatval($caisse_data['fond_de_caisse'] ?? 0);
        $ventes = floatval($caisse_data['ventes'] ?? 0);
        $retrocession = floatval($caisse_data['retrocession'] ?? 0);
        $recette_theorique = $ventes + $retrocession;
        $recette_reelle = $total_compte - $fond_de_caisse;
        $ecart = $recette_theorique > 0 ? $recette_reelle - $recette_theorique : 0;
        
        $results['caisses'][$caisse_id] = compact('total_compte', 'fond_de_caisse', 'ventes', 'retrocession', 'recette_theorique', 'recette_reelle', 'ecart');
        $results['combines']['total_compté'] += $total_compte;
        $results['combines']['recette_reelle'] += $recette_reelle;
        $results['combines']['recette_theorique'] += $recette_theorique;
        $results['combines']['ecart'] += $ecart;
    }
    
    return $results;
}


/**
 * Récupère une valeur numérique depuis un tableau, en gérant les chaînes vides et les virgules.
 *
 * @param array  $source_array Le tableau source (ex: $_POST).
 * @param string $key          La clé à récupérer.
 * @return float               La valeur numérique.
 */
function get_numeric_value($source_array, $key) {
    if (!isset($source_array[$key]) || $source_array[$key] === '') return 0;
    return floatval(str_replace(',', '.', $source_array[$key]));
}

/**
 * Formate un montant en chaîne de caractères monétaire avec le bon symbole.
 *
 * @param float $montant Le montant à formater.
 * @return string        Le montant formaté (ex: "1 234,56 €").
 */
function format_currency($montant) {
    $symbol = defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€';
    return number_format($montant, 2, ',', ' ') . ' ' . $symbol;
}

/**
 * Formate une date (chaîne) en format français long (ex: "lundi 1 janvier 2024 à 14:30").
 * Tente d'utiliser IntlDateFormatter pour une meilleure gestion des locales, sinon fallback PHP.
 *
 * @param string $date_string La date à formater.
 * @return string             La date formatée en français.
 */

function format_date_fr($date_string) {
    if (class_exists('IntlDateFormatter')) {
        $date = new DateTime($date_string);
        $formatter = new IntlDateFormatter('fr_FR', IntlDateFormatter::FULL, IntlDateFormatter::SHORT, null, null, 'eeee d MMMM yyyy, HH:mm');
        return $formatter->format($date);
    } else {
        // Fallback si l'extension intl n'est pas activée
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
