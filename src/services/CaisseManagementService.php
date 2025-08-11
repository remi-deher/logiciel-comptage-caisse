<?php
// src/services/CaisseManagementService.php

/**
 * Gère toutes les opérations de gestion des caisses (ajout, renommage, suppression).
 */
class CaisseManagementService {
    private $pdo;
    private $configService;

    public function __construct($pdo, $configService) {
        $this->pdo = $pdo;
        $this->configService = $configService;
    }

    /**
     * Ajoute une nouvelle caisse à la base de données et au fichier de configuration.
     */
    public function addCaisse($new_name) {
        global $noms_caisses, $denominations;
        
        if (empty($new_name)) {
            $_SESSION['admin_error'] = "Le nom de la nouvelle caisse ne peut pas être vide.";
            return;
        }
        
        try {
            $stmt = $this->pdo->query("SHOW COLUMNS FROM comptages");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $existing_ids = [];
            foreach ($columns as $column) {
                if (preg_match('/^c(\d+)_/', $column, $matches)) {
                    $existing_ids[] = (int)$matches[1];
                }
            }
            
            $new_id = empty($existing_ids) ? 1 : max($existing_ids) + 1;

            if (!is_int($new_id) || $new_id <= 0) {
                throw new Exception("Erreur critique lors de la génération de l'ID de la nouvelle caisse.");
            }

            $cols_to_add = [];
            $cols_to_add[] = "c{$new_id}_fond_de_caisse DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_ventes DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_retrocession DECIMAL(10, 2) DEFAULT 0";
            foreach ($denominations as $list) {
                foreach (array_keys($list) as $name) {
                    $cols_to_add[] = "c{$new_id}_{$name} INT DEFAULT 0";
                }
            }
            
            foreach($cols_to_add as $col) {
                $this->pdo->exec("ALTER TABLE comptages ADD COLUMN {$col}");
            }

        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de l'ajout de la caisse : " . $e->getMessage();
            return;
        }

        $noms_caisses[$new_id] = $new_name;
        $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
        $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$new_name}' ajoutée." : $result['message'];
    }

    /**
     * Renomme une caisse existante dans le fichier de configuration.
     */
    public function renameCaisse($id, $new_name) {
        global $noms_caisses;
        if ($id > 0 && !empty($new_name) && isset($noms_caisses[$id])) {
            $noms_caisses[$id] = $new_name;
            $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = $result['success'] ? "Caisse renommée." : $result['message'];
        } else {
            $_SESSION['admin_error'] = "Données invalides pour le renommage.";
        }
    }

    /**
     * Supprime une caisse de la base de données et du fichier de configuration.
     */
    public function deleteCaisse($id) {
        global $noms_caisses, $denominations;
        if ($id > 0 && isset($noms_caisses[$id])) {
            try {
                $cols_to_drop = [];
                $cols_to_drop[] = "c{$id}_fond_de_caisse";
                $cols_to_drop[] = "c{$id}_ventes";
                $cols_to_drop[] = "c{$id}_retrocession";
                
                foreach ($denominations as $list) {
                    foreach (array_keys($list) as $name) {
                        $cols_to_drop[] = "c{$id}_{$name}";
                    }
                }

                $sql = "ALTER TABLE comptages DROP COLUMN " . implode(', DROP COLUMN ', $cols_to_drop);
                $this->pdo->exec($sql);

            } catch (\Exception $e) {
                $_SESSION['admin_error'] = "Erreur BDD lors de la suppression des colonnes de la caisse : " . $e->getMessage();
                return;
            }
            
            $deleted_name = $noms_caisses[$id];
            unset($noms_caisses[$id]);

            $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$deleted_name}' et toutes ses données ont été supprimées." : $result['message'];
        } else {
            $_SESSION['admin_error'] = "ID de caisse invalide.";
        }
    }
}
