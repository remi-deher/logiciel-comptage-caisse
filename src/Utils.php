<?php
// src/Utils.php

/**
 * Calcule tous les totaux pour les caisses et les totaux combinés à partir d'un tableau de données.
 *
 * @param array $data_row        Les données d'un comptage provenant de la BDD.
 * @param int   $nombre_caisses  Le nombre total de caisses.
 * @param array $denominations   Le tableau des billets et pièces.
 * @return array                 Un tableau structuré avec les résultats.
 */
function calculate_results_from_data($data_row, $nombre_caisses, $denominations) {
    $results = ['caisses' => [], 'combines' => ['total_compté' => 0, 'recette_reelle' => 0, 'ecart' => 0, 'recette_theorique' => 0]];
    for ($i = 1; $i <= $nombre_caisses; $i++) {
        $total_compté = 0;
        foreach ($denominations as $list) {
            foreach ($list as $name => $value) {
                $total_compté += floatval($data_row["c{$i}_{$name}"] ?? 0) * $value;
            }
        }
        $fond_de_caisse = floatval($data_row["c{$i}_fond_de_caisse"] ?? 0);
        $ventes = floatval($data_row["c{$i}_ventes"] ?? 0);
        $retrocession = floatval($data_row["c{$i}_retrocession"] ?? 0);
        $recette_theorique = $ventes + $retrocession;
        $recette_reelle = $total_compté - $fond_de_caisse;
        $ecart = $recette_theorique > 0 ? $recette_reelle - $recette_theorique : 0;
        $results['caisses'][$i] = compact('total_compté', 'fond_de_caisse', 'ventes', 'retrocession', 'recette_theorique', 'recette_reelle', 'ecart');
        $results['combines']['total_compté'] += $total_compté;
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
 * Formate un montant en chaîne de caractères monétaire en euros.
 *
 * @param float $montant Le montant à formater.
 * @return string        Le montant formaté (ex: "1 234,56 €").
 */
function format_euros($montant) {
    return number_format($montant, 2, ',', ' ') . ' €';
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
        // Ligne corrigée ci-dessous
        $month = $months[date('n', $timestamp) - 1]; // Correction: $timestamp au lieu de 'timestamp'
        $year = date('Y', $timestamp);
        $time = date('H:i', $timestamp);
        return ucfirst($dayOfWeek) . ' ' . $dayOfMonth . ' ' . $month . ' ' . $year . ' à ' . $time;
    }
}