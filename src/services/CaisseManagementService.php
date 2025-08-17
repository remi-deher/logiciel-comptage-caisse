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
        if (empty($new_name)) {
            $_SESSION['admin_error'] = "Le nom de la nouvelle caisse ne peut pas être vide.";
            return;
        }

        try {
            // Étape 1 : Ajouter la nouvelle caisse à la table 'caisses'
            $stmt = $this->pdo->prepare("INSERT INTO caisses (nom_caisse) VALUES (?)");
            $stmt->execute([$new_name]);
            $new_id = $this->pdo->lastInsertId();

            // Étape 2 : Mettre à jour la configuration pour qu'elle inclue la nouvelle caisse
            global $noms_caisses;
            $noms_caisses[$new_id] = $new_name;
            $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);

            $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$new_name}' ajoutée." : $result['message'];

        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de l'ajout de la caisse : " . $e->getMessage();
        }
    }

    /**
     * Renomme une caisse existante dans la base de données et le fichier de configuration.
     */
    public function renameCaisse($id, $new_name) {
        if ($id > 0 && !empty($new_name)) {
            try {
                // Étape 1 : Mettre à jour la table 'caisses'
                $stmt = $this->pdo->prepare("UPDATE caisses SET nom_caisse = ? WHERE id = ?");
                $stmt->execute([$new_name, intval($id)]);

                // Étape 2 : Mettre à jour la configuration
                global $noms_caisses;
                $noms_caisses[intval($id)] = $new_name;
                $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);

                $_SESSION['admin_message'] = $result['success'] ? "Caisse renommée." : $result['message'];

            } catch (\Exception $e) {
                $_SESSION['admin_error'] = "Erreur BDD lors du renommage de la caisse : " . $e->getMessage();
            }
        } else {
            $_SESSION['admin_error'] = "Données invalides pour le renommage.";
        }
    }

    /**
     * Supprime une caisse de la base de données et du fichier de configuration.
     */
    public function deleteCaisse($id) {
        if ($id > 0) {
            try {
                // Étape 1 : Supprimer la caisse de la table 'caisses'
                // La suppression en cascade gérera les entrées correspondantes dans comptage_details
                $stmt = $this->pdo->prepare("DELETE FROM caisses WHERE id = ?");
                $stmt->execute([intval($id)]);

                // Étape 2 : Supprimer la caisse du fichier de configuration
                global $noms_caisses;
                $deleted_name = $noms_caisses[intval($id)] ?? 'Inconnu';
                unset($noms_caisses[intval($id)]);
                $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);

                $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$deleted_name}' et toutes ses données ont été supprimées." : $result['message'];

            } catch (\Exception $e) {
                $_SESSION['admin_error'] = "Erreur BDD lors de la suppression de la caisse : " . $e->getMessage();
            }
        } else {
            $_SESSION['admin_error'] = "ID de caisse invalide.";
        }
    }
}
