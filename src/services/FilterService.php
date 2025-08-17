<?php
// src/services/FilterService.php

class FilterService {
    /**
     * Construit la clause WHERE et les valeurs à lier pour les requêtes SQL.
     *
     * @param string $date_debut
     * @param string $date_fin
     * @param string|null $recherche
     * @param string|null $caisse_filtre
     * @param string $vue
     * @return array
     */
    public function getWhereClauseAndBindings($date_debut, $date_fin, $recherche = null, $caisse_filtre = null, $vue = 'tout') {
        $where_clauses = [];
        $bind_values = [];

        if ($vue === 'jour' && empty($date_debut) && empty($date_fin)) {
            $where_clauses[] = "DATE(date_comptage) = CURDATE()";
        }

        if (!empty($date_debut)) {
            $where_clauses[] = "date_comptage >= ?";
            $bind_values[] = $date_debut . " 00:00:00";
        }
        if (!empty($date_fin)) {
            $where_clauses[] = "date_comptage <= ?";
            $bind_values[] = $date_fin . " 23:59:59";
        }
        if (!empty($recherche)) {
            $where_clauses[] = "nom_comptage LIKE ?";
            $bind_values[] = "%" . $recherche . "%";
        }
        if (!empty($caisse_filtre)) {
            $where_clauses[] = "{$caisse_filtre} IS NOT NULL";
        }

        $sql_where = "";
        if (!empty($where_clauses)) {
            $sql_where = " WHERE " . implode(" AND ", $where_clauses);
        }

        return ['sql_where' => $sql_where, 'bind_values' => $bind_values];
    }
}
