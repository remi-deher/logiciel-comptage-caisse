<?php
// src/services/TerminalManagementService.php

/**
 * Gère toutes les opérations de gestion des terminaux de paiement.
 */
class TerminalManagementService {
    private $pdo;
    private $configService;

    public function __construct($pdo, $configService) {
        $this->pdo = $pdo;
        $this->configService = $configService;
    }

    /**
     * Ajoute un nouveau terminal à la base de données et met à jour la configuration.
     */
    public function addTerminal($nom, $caisseId) {
        if (empty($nom) || empty($caisseId)) {
            $_SESSION['admin_error'] = "Le nom du terminal et la caisse associée sont obligatoires.";
            return;
        }
        try {
            $stmt = $this->pdo->prepare("INSERT INTO terminaux_paiement (nom_terminal, caisse_associee) VALUES (?, ?)");
            $stmt->execute([$nom, $caisseId]);
            $this->updateTerminalsInConfig();
            $_SESSION['admin_message'] = "Terminal '{$nom}' ajouté avec succès.";
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de l'ajout du terminal : " . $e->getMessage();
        }
    }

    /**
     * Renomme et/ou réassocie un terminal existant.
     */
    public function renameTerminal($id, $newName, $newCaisseId) {
        if (empty($id) || empty($newName) || empty($newCaisseId)) {
            $_SESSION['admin_error'] = "Données invalides pour la modification.";
            return;
        }
        try {
            $stmt = $this->pdo->prepare("UPDATE terminaux_paiement SET nom_terminal = ?, caisse_associee = ? WHERE id = ?");
            $stmt->execute([$newName, $newCaisseId, $id]);
            $this->updateTerminalsInConfig();
            $_SESSION['admin_message'] = "Terminal mis à jour.";
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la mise à jour du terminal : " . $e->getMessage();
        }
    }

    /**
     * Supprime un terminal de la base de données.
     */
    public function deleteTerminal($id) {
        if (empty($id)) {
            $_SESSION['admin_error'] = "ID de terminal invalide.";
            return;
        }
        try {
            $stmt = $this->pdo->prepare("DELETE FROM terminaux_paiement WHERE id = ?");
            $stmt->execute([$id]);
            $this->updateTerminalsInConfig();
            $_SESSION['admin_message'] = "Terminal supprimé avec succès.";
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la suppression du terminal : " . $e->getMessage();
        }
    }

    /**
     * Met à jour la variable $tpe_par_caisse dans le fichier config.php.
     */
    private function updateTerminalsInConfig() {
        $stmt = $this->pdo->query("SELECT id, nom_terminal, caisse_associee FROM terminaux_paiement ORDER BY id");
        $terminalsFromDb = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $terminalsForConfig = [];
        foreach ($terminalsFromDb as $terminal) {
            $terminalsForConfig[$terminal['id']] = [
                'nom' => $terminal['nom_terminal'],
                'caisse_id' => (int)$terminal['caisse_associee']
            ];
        }

        // --- CORRECTION CI-DESSOUS ---
        // L'ancien nom de variable 'terminaux_paiement' a été remplacé par 'tpe_par_caisse'
        // pour correspondre à ce que le service de configuration attend.
        $this->configService->updateConfigFile(['tpe_par_caisse' => $terminalsForConfig]);
    }
}
